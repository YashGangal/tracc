import os
import json
import glob
import math
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.ai_provider import AIProvider
from app.db.session import SessionLocal
from app.db.models import Document, KnowledgeChunk
from app.schemas.logistics import RAGQueryResult, RAGCitation

logger = logging.getLogger(__name__)

SOPS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/sops"))
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/uploads"))


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Calculate cosine similarity between two normalized vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return dot / (norm1 * norm2)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks by words or sentences."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += (chunk_size - overlap)
    return chunks if chunks else [text]


def index_sop_documents(db: Optional[Session] = None):
    """
    Scan the official SOPs directory and index any un-indexed documents into the knowledge base.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        sop_files = glob.glob(os.path.join(SOPS_DIR, "*.md"))
        for file_path in sop_files:
            file_name = os.path.basename(file_path)
            existing = db.query(Document).filter(Document.name == file_name).first()
            if existing:
                continue

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            file_size = len(content.encode("utf-8"))
            doc = Document(
                name=file_name,
                file_type="md",
                storage_path=file_path,
                file_size=file_size,
                uploaded_by="System SOP Registry"
            )
            db.add(doc)
            db.flush()

            # Create chunks and vector embeddings
            chunks = chunk_text(content, chunk_size=200, overlap=30)
            for idx, chk in enumerate(chunks):
                emb = AIProvider.get_embedding(chk)
                kc = KnowledgeChunk(
                    document_id=doc.id,
                    chunk_index=idx,
                    chunk_text=chk,
                    embedding_json=json.dumps(emb),
                    metadata_json=json.dumps({"document_name": file_name, "chunk_index": idx})
                )
                db.add(kc)
            db.commit()
            print(f"[OK] Indexed knowledge base document: {file_name} ({len(chunks)} chunks).")
    finally:
        if should_close:
            db.close()


async def query_knowledge_base(user_query: str, db: Optional[Session] = None, top_k: int = 3) -> RAGQueryResult:
    """
    Search indexed knowledge base chunks, retrieve top matching snippets, and synthesize a grounded answer.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Verify if documents are indexed
        if db.query(Document).count() == 0:
            index_sop_documents(db)

        query_emb = AIProvider.get_embedding(user_query)
        # Cap scan to avoid unbounded memory when many documents are uploaded.
        # Oldest-first keeps the permanent SOP registry retrievable as uploads grow.
        chunks = db.query(KnowledgeChunk).order_by(KnowledgeChunk.id.asc()).limit(2000).all()

        scored_chunks = []
        for chk in chunks:
            if not chk.embedding_json:
                continue
            doc_emb = json.loads(chk.embedding_json)
            sim = cosine_similarity(query_emb, doc_emb)
            # Keyword bonus for exact matches on critical phrases (e.g. breakdown, detention, reefer, hos)
            words = user_query.lower().split()
            kw_match = sum(1 for w in words if len(w) > 3 and w in chk.chunk_text.lower())
            total_score = sim + (kw_match * 0.15)
            scored_chunks.append((total_score, chk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        top_matches = scored_chunks[:top_k]

        citations = []
        context_snippets = []
        for score, chk in top_matches:
            doc = db.query(Document).filter(Document.id == chk.document_id).first()
            doc_name = doc.name if doc else "SOP Documentation"
            clean_snippet = chk.chunk_text[:300] + ("..." if len(chk.chunk_text) > 300 else "")
            
            citations.append(RAGCitation(
                document_name=doc_name,
                section=f"Section Chunk #{chk.chunk_index + 1}",
                relevance_score=round(float(min(score, 1.0)), 3),
                snippet=clean_snippet
            ))
            context_snippets.append(f"[{doc_name}]: {chk.chunk_text}")

        # Check if score is high enough or if answer is likely missing
        max_score = top_matches[0][0] if top_matches else 0.0

        rag_prompt = f"""Context from verified company Standard Operating Procedures (SOPs):
{chr(10).join(context_snippets)}

User Question: {user_query}

CRITICAL INSTRUCTIONS:
1. Ground your answer strictly in the context above.
2. Quote relevant requirements or numerical thresholds (e.g. hours, fees, temperatures).
3. Always cite which document the procedure originates from.
4. If the provided context does not contain sufficient information to answer the question accurately, YOU MUST state: "I couldn't find this information in the available documents."
DO NOT hallucinate or fabricate operational rules!
"""

        answer = await AIProvider.generate_completion(
            prompt=rag_prompt,
            system_prompt="You are a strict, grounded AI Logistics Knowledge Assistant adhering to official SOPs.",
            temperature=0.1
        )

        return RAGQueryResult(
            query=user_query,
            answer=answer.strip(),
            citations=citations
        )
    finally:
        if should_close:
            db.close()
