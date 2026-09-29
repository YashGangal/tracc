import React, { useState } from "react";
import { BookOpen, Search, Upload, FileText, CheckCircle2, ChevronRight, AlertCircle, Sparkles, Filter, Trash2 } from "lucide-react";
import { DocumentItem } from "../../lib/types";
import { fetchDocChunks } from "../../lib/backend";
import { cn } from "../../lib/utils";

interface KnowledgeBaseViewProps {
  documents: DocumentItem[];
  canManage: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (doc: DocumentItem) => Promise<void>;
  onAskCopilot: (query: string) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents,
  canManage,
  onUpload,
  onDelete,
  onAskCopilot,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [sections, setSections] = useState<{ heading: string; text: string; page: number }[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedDoc = documents.find((d) => d.id === selectedId) || documents[0];

  const categories = ["All", "SOP", "Compliance", "Policy"];

  const filteredDocs = documents.filter((doc) => {
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  async function openDoc(id: string) {
    setSelectedId(id);
    setSections([]);
    setSectionsLoading(true);
    try {
      setSections(await fetchDocChunks(id));
    } catch {
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }

  // Load chunks for the first document on mount.
  React.useEffect(() => {
    if (documents.length > 0 && !selectedId) openDoc(documents[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length]);

  // Two-click delete: first click arms, second click confirms. Auto-disarms.
  async function handleDelete(e: React.MouseEvent, doc: DocumentItem) {
    e.stopPropagation();
    setDeleteError("");
    if (confirmDeleteId !== doc.id) {
      setConfirmDeleteId(doc.id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDeleteId(null), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmDeleteId(null);
    setDeletingId(doc.id);
    try {
      await onDelete(doc);
      if (selectedId === doc.id) setSelectedId(null);
    } catch (err: any) {
      setDeleteError(err?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  React.useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadError("");
    try {
      await onUpload(file);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-500" />
            <span>Logistics Knowledge Base & SOP RAG Engine</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Grounded vector indexed documents: Breakdown procedures, Missed Pickups, FSMA Cold-Chain, and Detention Policies.
          </p>
        </div>

        {/* Upload Button */}
        {canManage ? (
          <label className="px-3 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 cursor-pointer transition-colors inline-flex items-center gap-2 self-start sm:self-auto shadow-xs">
            <Upload className="w-4 h-4" />
            <span>{isUploading ? "Indexing chunks..." : "Upload SOP Document"}</span>
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        ) : (
          <span className="text-[11px] text-neutral-500 self-start sm:self-auto">
            Upload restricted to manager / admin roles
          </span>
        )}
      </div>

      {uploadError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {uploadError}
        </div>
      )}

      {deleteError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {deleteError}
        </div>
      )}

      {uploadSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Document parsed, chunked, and pgvector embeddings synchronized successfully.</span>
        </div>
      )}

      {/* Main split view: Document List + Document Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search & Document Stack (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search procedures, reefer temps, detention..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none"
              />
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                    selectedCategory === cat
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800/60"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Document list */}
          <div className="space-y-2.5">
            {filteredDocs.map((doc) => {
              const isSelected = selectedDoc?.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => openDoc(doc.id)}
                  className={cn(
                    "p-3.5 rounded-xl border text-xs cursor-pointer transition-all",
                    isSelected
                      ? "border-blue-500/40 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs"
                      : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {doc.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 uppercase">
                      {doc.fileType}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2 line-clamp-2">
                    {doc.summary}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-[10px] text-neutral-400 font-mono">
                    <span>{doc.pages} chunks · Updated {doc.updatedAt || "—"}</span>
                    <span className="flex items-center gap-2">
                      {canManage && doc.uploadedBy !== "System SOP Registry" && (
                        <button
                          onClick={(e) => handleDelete(e, doc)}
                          disabled={deletingId === doc.id}
                          title={confirmDeleteId === doc.id ? "Click again to confirm delete" : `Delete ${doc.title}`}
                          aria-label={`Delete ${doc.title}`}
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-sans font-medium transition-colors",
                            confirmDeleteId === doc.id
                              ? "bg-red-500 text-white"
                              : "text-neutral-400 hover:text-red-500 hover:bg-red-500/10",
                            deletingId === doc.id && "opacity-50"
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>
                            {deletingId === doc.id
                              ? "Deleting…"
                              : confirmDeleteId === doc.id
                                ? "Confirm?"
                                : "Delete"}
                          </span>
                        </button>
                      )}
                      <span className="text-blue-500 font-sans font-medium flex items-center gap-0.5">
                        View Sections <ChevronRight className="w-3 h-3" />
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Document Inspector (7 cols) */}
        <div className="lg:col-span-7 p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs space-y-4">
          {!selectedDoc ? (
            <p className="text-sm text-neutral-500">No documents indexed yet.</p>
          ) : (
            <>
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-blue-500 font-semibold">
                {selectedDoc.category} Document · {selectedDoc.id}
              </span>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                {selectedDoc.title}
              </h3>
              <p className="text-xs text-neutral-500 mt-1">
                {selectedDoc.summary}
              </p>
            </div>

            <button
              onClick={() => onAskCopilot(`Explain the procedure in ${selectedDoc.title}`)}
              className="px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 flex items-center gap-1.5 hover:bg-blue-100/60 transition-colors shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ask AI About This SOP</span>
            </button>
          </div>

          {/* Sections breakdown (live indexed chunks) */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block uppercase tracking-wider text-[11px]">
              Indexed Sections & Semantic Chunks
            </span>

            <div className="space-y-2.5">
              {sectionsLoading && <p className="text-xs text-neutral-400">Loading indexed chunks…</p>}
              {!sectionsLoading && sections.length === 0 && (
                <p className="text-xs text-neutral-400">No chunks loaded — select the document again to retry.</p>
              )}
              {sections.map((sec, i) => (
                <div
                  key={`${sec.heading}-${i}`}
                  className="p-3 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
                >
                  <div className="flex items-center justify-between font-medium text-neutral-900 dark:text-neutral-100 mb-1">
                    <span>{sec.heading}</span>
                    <span className="text-[10px] font-mono text-neutral-400">Chunk {sec.page}</span>
                  </div>
                  <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed text-[11px]">
                    "{sec.text}"
                  </p>
                </div>
              ))}
            </div>
          </div>
            </>
          )}

          {/* Grounding guarantee */}
          <div className="p-3 rounded-lg border border-blue-100 dark:border-blue-950 bg-blue-50/30 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <div className="leading-relaxed">
              <strong>Strict RAG Grounding Guarantee:</strong> If an operational question cannot be substantiated by verified text in these files, the AI Copilot responds with "Information not found in the knowledge base" rather than hallucinating procedures.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
