import os
import json
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Dict
from app.db.session import get_db
from app.db.models import Document, KnowledgeChunk, User
from app.schemas.logistics import RAGQueryResult, CopilotQueryRequest
from app.services.rag import query_knowledge_base, chunk_text, UPLOADS_DIR
from app.core.ai_provider import AIProvider
from app.api.v1.auth import get_current_user, require_roles
from app.services.audit import log_audit_event
from app.services.document_scan import DocumentScanError, scan_document_bytes

router = APIRouter(prefix="/rag", tags=["RAG Knowledge Base"], dependencies=[Depends(get_current_user)])

ALLOWED_DOCUMENT_EXTENSIONS = {".md", ".txt", ".pdf"}
MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024


@router.post("/query", response_model=RAGQueryResult)
async def query_knowledge(
    payload: CopilotQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await query_knowledge_base(payload.query, db=db)
        log_audit_event(
            db,
            "rag.query",
            "knowledge_query",
            actor=current_user,
            metadata={"query_length": len(payload.query), "citation_count": len(result.citations)},
        )
        db.commit()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge retrieval error: {e}")


@router.get("/documents")
def list_documents(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    docs = db.query(Document).order_by(Document.id.desc()).offset(offset).limit(limit).all()
    doc_ids = [d.id for d in docs]
    counts: Dict[int, int] = {}
    if doc_ids:
        for doc_id, count in db.query(
            KnowledgeChunk.document_id, func.count(KnowledgeChunk.id)
        ).filter(KnowledgeChunk.document_id.in_(doc_ids)).group_by(KnowledgeChunk.document_id).all():
            counts[doc_id] = count
    results = []
    for d in docs:
        results.append({
            "id": d.id,
            "name": d.name,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at,
            "chunk_count": counts.get(d.id, 0)
        })
    return results


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("operations_manager", "admin")),
):
    original_filename = file.filename or ""
    safe_filename = Path(original_filename).name
    if not safe_filename or safe_filename != original_filename:
        raise HTTPException(status_code=400, detail="A valid filename is required.")

    extension = Path(safe_filename).suffix.lower()
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only Markdown, text, and PDF documents are supported.")

    content_bytes = await file.read()
    if not content_bytes:
        raise HTTPException(status_code=400, detail="The uploaded document is empty.")
    if len(content_bytes) > MAX_DOCUMENT_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded document exceeds the 10 MB limit.")

    try:
        scan_document_bytes(content_bytes)
    except DocumentScanError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    if db.query(Document).filter(Document.name == safe_filename).first():
        raise HTTPException(status_code=409, detail="A document with this filename is already indexed.")

    try:
        if extension == ".pdf":
            reader = PdfReader(BytesIO(content_bytes))
            text_content = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        else:
            text_content = content_bytes.decode("utf-8").strip()
    except (PdfReadError, UnicodeDecodeError, ValueError) as error:
        raise HTTPException(status_code=400, detail="The uploaded document could not be read.") from error

    if not text_content:
        raise HTTPException(status_code=400, detail="The uploaded document does not contain extractable text.")

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    save_path = os.path.join(UPLOADS_DIR, f"{uuid4().hex}_{safe_filename}")
    with open(save_path, "xb") as f:
        f.write(content_bytes)

    doc = Document(
        name=safe_filename,
        file_type=extension.lstrip("."),
        storage_path=save_path,
        file_size=len(content_bytes),
        uploaded_by=current_user.full_name
    )
    db.add(doc)
    db.flush()

    chunks = chunk_text(text_content, chunk_size=200, overlap=30)
    for idx, chk in enumerate(chunks):
        emb = AIProvider.get_embedding(chk)
        kc = KnowledgeChunk(
            document_id=doc.id,
            chunk_index=idx,
            chunk_text=chk,
            embedding_json=json.dumps(emb),
            metadata_json=json.dumps({"document_name": safe_filename, "chunk_index": idx})
        )
        db.add(kc)
    log_audit_event(
        db,
        "knowledge_document.upload",
        "document",
        actor=current_user,
        entity_id=doc.id,
        metadata={"filename": safe_filename, "file_type": extension.lstrip("."), "file_size": len(content_bytes)},
    )
    try:
        db.commit()
    except Exception:
        db.rollback()
        if os.path.exists(save_path):
            os.remove(save_path)
        raise

    return {
        "status": "success",
        "document_id": doc.id,
        "filename": safe_filename,
        "chunks_indexed": len(chunks)
    }


@router.get("/documents/{doc_id}/chunks")
def get_document_chunks(
    doc_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return indexed chunks for a document (powers the SOP reader)."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    chunks = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.document_id == doc_id)
        .order_by(KnowledgeChunk.chunk_index.asc())
        .limit(limit)
        .all()
    )
    return {
        "document_id": doc.id,
        "document_name": doc.name,
        "chunks": [
            {"chunk_index": c.chunk_index, "chunk_text": c.chunk_text}
            for c in chunks
        ],
    }
