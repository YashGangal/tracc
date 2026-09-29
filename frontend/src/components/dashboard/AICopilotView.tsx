import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Sparkles, Send, Terminal, Database, CheckCircle2, ShieldCheck, ArrowRight, CornerDownLeft, FileText, Square, Plus } from "lucide-react";
import { AgentFlow, AgentStep } from "../codedvisuals/AgentFlow";
import { RetrievalFlow, RetrievedSource } from "../codedvisuals/RetrievalFlow";
import { DotmSquare11 } from "../ui/dotm-square-11";
import { copilotAgent, copilotChat, copilotSql, ragQuery } from "../../lib/backend";
import { ApiError, friendlyError } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { LoadItem } from "../../lib/types";
import { formatCurrency, formatPercent, cn } from "../../lib/utils";

interface AICopilotViewProps {
  initialQuery?: string;
  onSelectLoad?: (load: LoadItem) => void;
}

interface MessageHistory {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  mode?: string;
  query?: string;
  steps?: AgentStep[];
  sqlQuery?: string;
  tableData?: any[];
  tableType?: "loads" | "carriers";
  genericColumns?: string[];
  ragSources?: RetrievedSource[];
}

type ModeOverride = "auto" | "sql" | "rag" | "agent";

const CHAT_STARTERS = [
  "Hi!",
  "What can you do?",
  "Which loads are delayed right now?",
  "How is driver Garcia doing?",
  "What is the breakdown protocol?",
];

const MODE_BADGE: Record<string, string> = {
  chitchat: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  sql: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  rag: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  agent: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

const MODE_LABEL: Record<string, string> = {
  chitchat: "Chat",
  sql: "SQL",
  rag: "SOP",
  agent: "Agent",
};

const WELCOME_TEXT =
  "Hey! I'm **Tracc**, your AI dispatch copilot. Ask me about loads, delays, carriers, drivers, or SOPs — or just say hi.";

function newSessionId() {
  return Math.random().toString(36).slice(2, 10);
}

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  initialQuery = "",
  onSelectLoad,
}) => {
  const [inputQuery, setInputQuery] = useState(initialQuery);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modeOverride, setModeOverride] = useState<ModeOverride>("auto");
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [messages, setMessages] = useState<MessageHistory[]>([
    {
      id: "msg-welcome",
      sender: "copilot",
      text: WELCOME_TEXT,
      timestamp: "Just now",
      mode: "chitchat",
    },
  ]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Deep links (drawer "Ask AI") arrive while the view stays mounted.
  useEffect(() => {
    if (initialQuery) {
      setInputQuery(initialQuery);
      handleRunQuery(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isProcessing]);

  function pushCopilot(msg: MessageHistory) {
    setMessages((prev) => [...prev, msg]);
  }

  function mapTraces(traces: any[]): AgentStep[] {
    return (traces || []).map((t: any) => ({
      id: `step-${t.step}`,
      name: String(t.action || `step-${t.step}`),
      description: t.thought || "",
      status: "complete" as const,
      detail: t.observation || "",
    }));
  }

  function mapSources(citations: any[]): RetrievedSource[] {
    return (citations || []).map((c: any, i: number) => ({
      documentId: c.document_name,
      title: c.document_name,
      category: "SOP",
      page: undefined,
      relevanceScore: c.relevance_score ?? 0,
      excerpt: c.snippet || "",
      selected: i === 0,
    }));
  }

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleNewChat = () => {
    if (isProcessing) return;
    setSessionId(newSessionId());
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: "copilot",
        text: WELCOME_TEXT,
        timestamp: "Just now",
        mode: "chitchat",
      },
    ]);
  };

  const handleRunQuery = async (queryText: string) => {
    if (!queryText.trim() || isProcessing) return;

    const userMsg: MessageHistory = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: queryText,
      timestamp: "Just now",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsProcessing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      if (modeOverride === "auto") {
        await runChat(queryText, signal);
      } else {
        await runLegacy(modeOverride, queryText, signal);
      }
    } catch (e: any) {
      if (e instanceof ApiError && e.status === -1) {
        pushCopilot({
          id: `cpl-${Date.now()}`,
          sender: "copilot",
          text: "Response stopped.",
          timestamp: "Just now",
          mode: "chitchat",
        });
      } else {
        pushCopilot({
          id: `cpl-${Date.now()}`,
          sender: "copilot",
          text: `Request failed: ${friendlyError(e)}. Check backend connectivity and try again.`,
          timestamp: "Just now",
        });
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  };

  async function runChat(queryText: string, signal: AbortSignal) {
    const res = await copilotChat(queryText, sessionId, signal);
    if (res.session_id && res.session_id !== sessionId) setSessionId(res.session_id);
    const mode: string = res.mode_used || "agent";
    const base = {
      id: `cpl-${Date.now()}`,
      sender: "copilot" as const,
      text: res.reply || "Copilot completed without an answer.",
      timestamp: "Just now",
      mode,
      query: queryText,
    };
    if (mode === "rag") {
      const sources = mapSources(res.citations);
      pushCopilot({
        ...base,
        steps: [
          { id: "intent", name: "Intent Classification", description: "RAG knowledge-base retrieval", status: "complete" },
          { id: "database", name: "Vector Search", description: "Cosine search over indexed SOP chunks", status: "complete", detail: `Retrieved top ${sources.length} chunks` },
          { id: "analysis", name: "Synthesize Grounded Answer", description: "Answer strictly from retrieved passages", status: "complete" },
        ],
        ragSources: sources,
      });
    } else if (mode === "sql") {
      const cols: string[] = res.columns || [];
      const rows: any[][] = res.rows || [];
      pushCopilot({
        ...base,
        steps: [
          { id: "intent", name: "Intent Classification", description: "Analytical SQL query", status: "complete" },
          { id: "sql", name: "Generate SQL", description: "Read-only SELECT with schema constraints", status: "complete" },
          { id: "validate", name: "Security Validation", description: "SELECT-only whitelist enforced", status: "complete" },
          { id: "database", name: "Execute Query", description: `${res.row_count ?? rows.length} rows`, status: "complete" },
        ],
        sqlQuery: res.generated_sql,
        tableData: rows.map((r, i) => ({ id: `row-${i}`, __cells: r })),
        tableType: undefined,
        genericColumns: cols,
      });
    } else if (mode === "agent") {
      pushCopilot({ ...base, steps: mapTraces(res.action_traces) });
    } else {
      pushCopilot(base);
    }
  }

  async function runLegacy(mode: "sql" | "rag" | "agent", queryText: string, signal: AbortSignal) {
    if (mode === "rag") {
      const res = await ragQuery(queryText, signal);
      const sources = mapSources(res.citations);
      pushCopilot({
        id: `cpl-${Date.now()}`,
        sender: "copilot",
        text: res.answer || "No grounded answer returned.",
        timestamp: "Just now",
        mode: "rag",
        query: queryText,
        steps: [
          { id: "intent", name: "Intent Classification", description: "RAG knowledge-base retrieval", status: "complete" },
          { id: "database", name: "Vector Search", description: "Cosine search over indexed SOP chunks", status: "complete", detail: `Retrieved top ${sources.length} chunks` },
          { id: "analysis", name: "Synthesize Grounded Answer", description: "Answer strictly from retrieved passages", status: "complete" },
        ],
        ragSources: sources,
      });
    } else if (mode === "sql") {
      const res = await copilotSql(queryText, signal);
      const cols: string[] = res.columns || [];
      const rows: any[][] = res.rows || [];
      pushCopilot({
        id: `cpl-${Date.now()}`,
        sender: "copilot",
        text: res.explanation || "Query executed against live tables.",
        timestamp: "Just now",
        mode: "sql",
        query: queryText,
        steps: [
          { id: "intent", name: "Intent Classification", description: "Analytical SQL query", status: "complete" },
          { id: "sql", name: "Generate SQL", description: "Read-only SELECT with schema constraints", status: "complete" },
          { id: "validate", name: "Security Validation", description: "SELECT-only whitelist enforced", status: "complete" },
          { id: "database", name: "Execute Query", description: `${res.row_count ?? rows.length} rows in ${res.execution_time_ms ?? "—"} ms`, status: "complete" },
        ],
        sqlQuery: res.generated_sql,
        tableData: rows.map((r, i) => ({ id: `row-${i}`, __cells: r })),
        tableType: undefined,
        genericColumns: cols,
      });
    } else {
      const res = await copilotAgent(queryText, signal);
      pushCopilot({
        id: `cpl-${Date.now()}`,
        sender: "copilot",
        text: res.final_answer || "Agent completed without an answer.",
        timestamp: "Just now",
        mode: "agent",
        query: queryText,
        steps: mapTraces(res.action_traces),
      });
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-white dark:bg-neutral-950">
      {/* Top Banner / Disclaimer following PRD Safety UX */}
      <div className="px-6 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>
            <strong>AI Operations Copilot:</strong> Read-only database access enabled. High-impact operational actions require human dispatcher approval.
          </span>
        </div>
        <span className="font-mono text-[11px] text-neutral-400">Model: live backend AI</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-5xl text-xs",
              msg.sender === "user" ? "ml-auto justify-end" : ""
            )}
          >
            {msg.sender === "copilot" && (
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={cn(
                "rounded-xl p-4 space-y-3 leading-relaxed",
                msg.sender === "user"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium max-w-2xl"
                  : "bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 max-w-3xl flex-1 min-w-0"
              )}
            >
              {msg.sender === "copilot" && msg.mode && (
                <span
                  title={msg.mode === "chitchat" ? "Conversational reply" : `Routed: ${msg.mode}`}
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[10px] font-medium uppercase tracking-wide",
                    MODE_BADGE[msg.mode] || MODE_BADGE.chitchat
                  )}
                >
                  {MODE_LABEL[msg.mode] || msg.mode}
                </span>
              )}
              <div className="whitespace-pre-line text-xs sm:text-sm">
                <Markdown text={msg.text} />
              </div>

              {/* RAG Sources Citations */}
              {msg.ragSources && (
                <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <RetrievalFlow
                    query={msg.query || "SOP Request"}
                    sources={msg.ragSources}
                  />
                </div>
              )}

              {/* Agent Flow Pipeline Visualization */}
              {msg.steps && (
                <div className="mt-3">
                  <AgentFlow steps={msg.steps} sqlQuery={msg.sqlQuery} />
                </div>
              )}

              {/* Data Table Result */}
              {msg.tableData && msg.tableData.length > 0 && (
                <div className="mt-3 overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-800/80 font-mono text-[11px] text-neutral-500">
                        {msg.genericColumns ? (
                          msg.genericColumns.map((c) => (
                            <th key={c} className="py-2 px-3">{c}</th>
                          ))
                        ) : msg.tableType === "loads" ? (
                          <>
                            <th className="py-2 px-3">Load ID</th>
                            <th className="py-2 px-3">Route</th>
                            <th className="py-2 px-3">Carrier</th>
                            <th className="py-2 px-3 text-right">Late Risk</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </>
                        ) : (
                          <>
                            <th className="py-2 px-3">Carrier</th>
                            <th className="py-2 px-3">MC#</th>
                            <th className="py-2 px-3 text-right">Loads</th>
                            <th className="py-2 px-3 text-right">On-Time %</th>
                            <th className="py-2 px-3 text-right">Late %</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {msg.tableData.map((row: any) => (
                        <tr key={row.id} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40">
                          {msg.genericColumns ? (
                            row.__cells.map((v: any, j: number) => (
                              <td key={j} className="py-2 px-3 font-mono tabular-nums">{String(v ?? "—")}</td>
                            ))
                          ) : msg.tableType === "loads" ? (
                            <>
                              <td className="py-2 px-3 font-mono font-semibold text-blue-500">
                                {row.id}
                              </td>
                              <td className="py-2 px-3">
                                {row.origin} → {row.destination}
                              </td>
                              <td className="py-2 px-3">{row.carrierName}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-red-500">
                                {Math.round(row.lateProbability * 100)}%
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => onSelectLoad?.(row)}
                                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  Inspect <ArrowRight className="w-3 h-3" />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2 px-3 font-medium">{row.name}</td>
                              <td className="py-2 px-3 font-mono text-neutral-400">{row.mcNumber}</td>
                              <td className="py-2 px-3 text-right font-mono">{row.totalLoads}</td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-red-500">
                                {row.onTimeRate}%
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-neutral-500">
                                {row.lateRate}%
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {msg.sender === "user" && (
              <div className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 font-semibold text-xs mt-0.5">
                AV
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3 max-w-2xl text-xs">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="rounded-xl p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 space-y-2">
              <div className="flex items-center gap-3">
                <DotmSquare11 size={32} dotSize={4} color="#3b82f6" ariaLabel="Copilot is answering" />
                <div className="space-y-1">
                  <p className="font-mono text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                    Copilot is answering…
                  </p>
                  <p className="font-mono text-[10px] opacity-70">
                    Parsing intent → querying live backend
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-4 sm:px-6 py-2 border-t border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            onClick={handleNewChat}
            disabled={isProcessing}
            title="Start a new conversation"
            className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-3 h-3" /> New chat
          </button>
          <span className="text-[11px] text-neutral-400 font-medium shrink-0">Try:</span>
          {CHAT_STARTERS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleRunQuery(prompt)}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 text-left whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input query field */}
      <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-2 max-w-4xl mx-auto mb-2">
          {(["auto", "sql", "rag", "agent"] as ModeOverride[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeOverride(m)}
              disabled={isProcessing}
              title={m === "auto" ? "Let Tracc route your question" : `Force ${m.toUpperCase()} mode`}
              className={cn(
                "px-2.5 py-1 rounded-md font-mono text-[11px] font-medium border transition-colors disabled:opacity-50",
                modeOverride === m
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent"
                  : "text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
              )}
            >
              {m === "auto" ? "Auto" : m.toUpperCase()}
            </button>
          ))}
          {modeOverride !== "auto" && (
            <span className="text-[11px] text-neutral-400">Forced {modeOverride.toUpperCase()} — switch to Auto for smart routing</span>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunQuery(inputQuery);
          }}
          className="flex items-center gap-2 relative max-w-4xl mx-auto"
        >
          <input
            type="text"
            placeholder="Message Tracc… ask about loads, carriers, risk, or SOPs"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
          />
          {isProcessing ? (
            <button
              type="button"
              onClick={handleStop}
              title="Stop response"
              className="px-4 py-2.5 rounded-lg bg-red-500 text-white font-medium text-xs sm:text-sm hover:bg-red-600 transition-colors flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="px-4 py-2.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs sm:text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
