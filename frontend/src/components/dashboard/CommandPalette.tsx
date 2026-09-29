import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Truck, Building2, BookOpen, Sparkles, X, ArrowRight, CornerDownLeft } from "lucide-react";
import { LoadItem, CarrierItem, DocumentItem } from "../../lib/types";
import { cn } from "../../lib/utils";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  loads: LoadItem[];
  carriers: CarrierItem[];
  documents: DocumentItem[];
  onSelectLoad: (load: LoadItem) => void;
  onSelectCarrier: (carrier: CarrierItem) => void;
  onSelectDocument: (doc: DocumentItem) => void;
  onTriggerCopilotQuery: (query: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpen,
  loads,
  carriers,
  documents,
  onSelectLoad,
  onSelectCarrier,
  onSelectDocument,
  onTriggerCopilotQuery,
}) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          onOpen();
        }
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  const filteredLoads = loads.filter(
    (l) =>
      l.id.toLowerCase().includes(query.toLowerCase()) ||
      l.origin.toLowerCase().includes(query.toLowerCase()) ||
      l.destination.toLowerCase().includes(query.toLowerCase()) ||
      l.carrierName.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCarriers = carriers.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.mcNumber.toLowerCase().includes(query.toLowerCase())
  );

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase()) ||
    d.summary.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
          />

            {/* Modal Card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette: search loads, carriers, and documents"
              initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden z-10"
          >
            {/* Search Input bar */}
            <div className="flex items-center px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 gap-3">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search loads, carriers, SOPs, or ask AI..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="text-[10px] font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                ESC
              </kbd>
            </div>

            {/* Quick results container */}
            <div className="max-h-96 overflow-y-auto p-2 space-y-3 text-xs">
              {/* Ask AI Copilot quick action */}
              {query.trim().length > 2 && (
                <button
                  onClick={() => {
                    onTriggerCopilotQuery(query);
                    onClose();
                  }}
                  aria-label={`Ask AI Copilot about ${query}`}
                  className="w-full p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 cursor-pointer transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span>
                      Ask AI Copilot: <strong className="font-semibold">"{query}"</strong>
                    </span>
                  </div>
                  <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />
                </button>
              )}

              {/* Loads section */}
              {filteredLoads.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Loads ({filteredLoads.length})
                  </div>
                  <div className="space-y-1">
                    {filteredLoads.slice(0, 4).map((ld) => (
                      <button
                        key={ld.id}
                        onClick={() => {
                          onSelectLoad(ld);
                          onClose();
                        }}
                        className="w-full p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/60 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Truck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <div>
                            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                              {ld.id}
                            </span>
                            <span className="text-neutral-400 mx-1.5">·</span>
                            <span className="text-neutral-600 dark:text-neutral-300">
                              {ld.origin} → {ld.destination}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] text-neutral-500">
                          {ld.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Carriers section */}
              {filteredCarriers.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Carriers ({filteredCarriers.length})
                  </div>
                  <div className="space-y-1">
                    {filteredCarriers.slice(0, 3).map((car) => (
                      <button
                        key={car.id}
                        onClick={() => {
                          onSelectCarrier(car);
                          onClose();
                        }}
                        className="w-full p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/60 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {car.name}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-400">
                            ({car.mcNumber})
                          </span>
                        </div>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          {car.onTimeRate}% on-time
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge SOPs */}
              {filteredDocs.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Knowledge Base SOPs ({filteredDocs.length})
                  </div>
                  <div className="space-y-1">
                    {filteredDocs.slice(0, 3).map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          onSelectDocument(doc);
                          onClose();
                        }}
                        className="w-full p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/60 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <BookOpen className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {doc.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                          {doc.category}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredLoads.length === 0 &&
                filteredCarriers.length === 0 &&
                filteredDocs.length === 0 &&
                query.trim().length > 0 && (
                  <div className="p-6 text-center text-neutral-400">
                    <p>No operational items matching "{query}".</p>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Press Enter to ask the AI Operations Copilot directly.
                    </p>
                  </div>
                )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
