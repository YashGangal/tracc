import React from "react";
import { motion } from "motion/react";
import { FileText, ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";

export interface RetrievedSource {
  documentId: string;
  title: string;
  category: string;
  page?: number;
  relevanceScore: number; // e.g. 0.94
  excerpt: string;
  selected?: boolean;
}

interface RetrievalFlowProps {
  query: string;
  sources: RetrievedSource[];
  isSearching?: boolean;
  className?: string;
  onSelectSource?: (source: RetrievedSource) => void;
}

export const RetrievalFlow: React.FC<RetrievalFlowProps> = ({
  query,
  sources,
  isSearching = false,
  className,
  onSelectSource,
}) => {
  return (
    <div className={cn("space-y-3 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 text-xs", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider text-[11px]">
            RAG Vector Retrieval Flow
          </span>
        </div>
        <span className="text-[10px] font-mono text-neutral-400">
          pgvector / cosine distance
        </span>
      </div>

      <div className="p-2.5 rounded bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
          <span className="text-[10px] font-mono text-neutral-400">Query:</span>
          <span className="font-medium italic">"{query}"</span>
        </div>
        {isSearching && (
          <span className="text-[10px] text-blue-500 font-mono animate-pulse">
            Scanning 4 index partitions...
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[11px] text-neutral-500 font-medium">
          Grounded Source Passages ({sources.length} matches)
        </div>

        <div className="grid grid-cols-1 gap-2">
          {sources.map((src, i) => {
            const pct = Math.round(src.relevanceScore * 100);
            return (
              <motion.div
                key={src.documentId + i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                onClick={() => onSelectSource?.(src)}
                className={cn(
                  "p-2.5 rounded border transition-all cursor-pointer",
                  src.selected
                    ? "bg-blue-500/10 border-blue-500/40 text-neutral-900 dark:text-neutral-100"
                    : "bg-neutral-50/50 dark:bg-neutral-800/30 border-neutral-200/60 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                    <FileText className="w-3 h-3 text-neutral-400" />
                    <span>{src.title}</span>
                    {src.page && (
                      <span className="text-[10px] text-neutral-400 font-mono">
                        (p. {src.page})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {pct}% match
                    </span>
                    <ExternalLink className="w-3 h-3 text-neutral-400 opacity-60" />
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                  "{src.excerpt}"
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
