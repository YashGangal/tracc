import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, ShieldCheck, Square, Plus, User } from "lucide-react";
import { AgentFlow, AgentStep } from "../codedvisuals/AgentFlow";
import { RetrievalFlow, RetrievedSource } from "../codedvisuals/RetrievalFlow";
import { DotmSquare11 } from "../ui/dotm-square-11";
import { copilotAgent, copilotChatStream, copilotSql, ragQuery } from "../../lib/backend";
import { ApiError, friendlyError } from "../../lib/api";
import { Markdown } from "../../lib/markdown";
import { cn } from "../../lib/utils";

interface AICopilotViewProps {
  initialQuery?: string;
  live?: boolean;
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

function nowTime() {
  try {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Just now";
  }
}

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  initialQuery = "",
  live = true,
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastHandledQueryRef = useRef<string>("");

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
    lastHandledQueryRef.current = "";
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
    const trimmed = queryText.trim();
    if (!trimmed || isProcessing) return;

    const userMsg: MessageHistory = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsProcessing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      if (modeOverride === "auto") {
        await runChat(trimmed, signal);
      } else {
        await runLegacy(modeOverride, trimmed, signal);
      }
    } catch (e: any) {
      if (e instanceof ApiError && e.status === -1) {
        pushCopilot({
          id: `cpl-${Date.now()}`,
          sender: "copilot",
          text: "Response stopped.",
          timestamp: nowTime(),
          mode: "chitchat",
        });
      } else {
        pushCopilot({
          id: `cpl-${Date.now()}`,
          sender: "copilot",
          text: `Request failed: ${friendlyError(e)}. Check backend connectivity and try again.`,
          timestamp: nowTime(),
        });
      }
    } finally {
      setIsProcessing(false);
      abortRef.current = null;
    }
  };

  async function runChat(queryText: string, signal: AbortSignal) {
    const msgId = `cpl-${Date.now()}`;
    pushCopilot({
      id: msgId,
      sender: "copilot",
      text: "",
      timestamp: nowTime(),
      query: queryText,
    });
    const done = await copilotChatStream(queryText, sessionId, (tok) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: m.text + tok } : m)));
    }, signal);
    if (done.session_id && done.session_id !== sessionId) setSessionId(done.session_id);
    const mode: string = done.mode_used || "agent";
    const base = {
      sender: "copilot" as const,
      timestamp: nowTime(),
      mode,
      query: queryText,
    };
    const finalize = (patch: Partial<MessageHistory>) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                ...base,
                ...patch,
                text: m.text || "Copilot completed without an answer.",
              }
            : m
        )
      );
    };
    if (mode === "rag") {
      const sources = mapSources(done.citations);
      finalize({
        steps: [
          { id: "intent", name: "Intent Classification", description: "RAG knowledge-base retrieval", status: "complete" },
          { id: "database", name: "Vector Search", description: "Cosine search over indexed SOP chunks", status: "complete", detail: `Retrieved top ${sources.length} chunks` },
          { id: "analysis", name: "Synthesize Grounded Answer", description: "Answer strictly from retrieved passages", status: "complete" },
        ],
        ragSources: sources,
      });
    } else if (mode === "sql") {
      const cols: string[] = done.columns || [];
      const rows: any[][] = done.rows || [];
      finalize({
        steps: [
          { id: "intent", name: "Intent Classification", description: "Analytical SQL query", status: "complete" },
          { id: "sql", name: "Generate SQL", description: "Read-only SELECT with schema constraints", status: "complete" },
          { id: "validate", name: "Security Validation", description: "SELECT-only whitelist enforced", status: "complete" },
          { id: "database", name: "Execute Query", description: `${done.row_count ?? rows.length} rows`, status: "complete" },
        ],
        sqlQuery: done.generated_sql,
        tableData: rows.map((r, i) => ({ id: `row-${i}`, __cells: r })),
        genericColumns: cols,
      });
    } else if (mode === "agent") {
      finalize({ steps: mapTraces(done.action_traces) });
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
        timestamp: nowTime(),
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
        timestamp: nowTime(),
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
        genericColumns: cols,
      });
    } else {
      const res = await copilotAgent(queryText, signal);
      pushCopilot({
        id: `cpl-${Date.now()}`,
        sender: "copilot",
        text: res.final_answer || "Agent completed without an answer.",
        timestamp: nowTime(),
        mode: "agent",
        query: queryText,
        steps: mapTraces(res.action_traces),
      });
    }
  }

  // Deep links (drawer "Ask AI") arrive while the view stays mounted.
  // Guard against repeat runs of the same string; App clears to "" between
  // repeats so a retrigger is observable here.
  useEffect(() => {
    const q = initialQuery.trim();
    if (q && q !== lastHandledQueryRef.current) {
      lastHandledQueryRef.current = q;
      setInputQuery(q);
      void handleRunQuery(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  // Autoscroll only when the reader is already near the bottom, so history
  // review is never yanked. Respect reduced-motion for the scroll itself.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 140 && messages.length > 1) return;
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, isProcessing]);

  return (
    <div className="h-[calc(100dvh-3.5rem)] min-h-0 flex flex-col bg-white dark:bg-neutral-950">
      {/* Top Banner / Disclaimer following PRD Safety UX */}
      <div className="px-4 sm:px-6 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center items-start gap-1.5 sm:gap-2 sm:justify-between text-xs">
        <div className="flex items-start sm:items-center gap-2 text-neutral-600 dark:text-neutral-400 min-w-0">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
          <span className="leading-relaxed">
            <strong>AI Operations Copilot:</strong> Read-only database access enabled. High-impact operational actions require human dispatcher approval.
          </span>
        </div>
        <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">
          {live ? "Model: live backend AI" : "Model: demo snapshot — backend offline"}
        </span>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        role="log"
        aria-live="polite"
        aria-label="AI copilot conversation"
        aria-busy={isProcessing}
        className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 w-full min-w-0 max-w-5xl text-xs",
              msg.sender === "user" ? "ml-auto justify-end" : ""
            )}
          >
            {msg.sender === "copilot" && (
              <div aria-hidden="true" className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
            )}

            <div
              className={cn(
                "rounded-xl p-4 space-y-3 leading-relaxed min-w-0 break-words",
                msg.sender === "user"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 max-w-2xl"
                  : "bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 max-w-3xl flex-1"
              )}
            >
              {msg.sender === "copilot" && (
                <div className="flex items-center gap-2 flex-wrap">
                  {msg.mode && (
                    <span
                      title={msg.mode === "chitchat" ? "Conversational reply" : `Routed: ${msg.mode}`}
                      aria-label={`Mode: ${MODE_LABEL[msg.mode] || msg.mode}`}
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[10px] font-medium uppercase tracking-wide",
                        MODE_BADGE[msg.mode] || MODE_BADGE.chitchat
                      )}
                    >
                      {MODE_LABEL[msg.mode] || msg.mode}
                    </span>
                  )}
                  <time className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                    {msg.timestamp}
                  </time>
                </div>
              )}
              {msg.sender === "user" && (
                <div className="flex justify-end">
                  <time className="font-mono text-[10px] text-white/70 dark:text-neutral-500">
                    {msg.timestamp}
                  </time>
                </div>
              )}
              <div className="text-xs sm:text-sm min-w-0 break-words">
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
              {msg.tableData && msg.genericColumns && msg.tableData.length > 0 && (
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Query results table, scroll horizontally to see more"
                  className="mt-3 overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Query results</caption>
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-800/80 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                        {msg.genericColumns.map((c) => (
                          <th key={c} scope="col" className="py-2 px-3 font-semibold whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {msg.tableData.map((row: any) => (
                        <tr key={row.id} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40">
                          {row.__cells.map((v: any, j: number) => (
                            <td key={j} className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">{String(v ?? "—")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {msg.tableData && msg.genericColumns && msg.tableData.length === 0 && (
                <p role="status" className="mt-3 text-[11px] text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2">
                  No rows returned for this query.
                </p>
              )}
            </div>

            {msg.sender === "user" && (
              <div aria-hidden="true" className="w-7 h-7 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-3 max-w-2xl text-xs" role="status">
            <div aria-hidden="true" className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="rounded-xl p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 space-y-2 min-w-0">
              <div className="flex items-center gap-3">
                <DotmSquare11 size={32} dotSize={4} color="#3b82f6" ariaLabel="Copilot is answering" />
                <div className="space-y-1">
                  <p className="font-mono text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                    Copilot is answering…
                  </p>
                  <p className="font-mono text-[10px] opacity-70">
                    {live ? "Parsing intent → querying live backend" : "Parsing intent → checking demo snapshot"}
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
        <div aria-label="Suggested prompts" className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isProcessing}
            title="Start a new conversation"
            aria-label="Start a new conversation"
            className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus className="w-3 h-3" aria-hidden="true" /> New chat
          </button>
          <span aria-hidden="true" className="text-[11px] text-neutral-500 font-medium shrink-0">Try:</span>
          {CHAT_STARTERS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void handleRunQuery(prompt)}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 text-left whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input query field */}
      <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div role="group" aria-label="Copilot mode" className="flex flex-wrap items-center gap-2 max-w-4xl mx-auto mb-2">
          {(["auto", "sql", "rag", "agent"] as ModeOverride[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModeOverride(m)}
              disabled={isProcessing}
              aria-pressed={modeOverride === m}
              title={m === "auto" ? "Let Tracc route your question" : `Force ${m.toUpperCase()} mode`}
              className={cn(
                "px-2.5 py-1 rounded-md font-mono text-[11px] font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                modeOverride === m
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent"
                  : "text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
              )}
            >
              {m === "auto" ? "Auto" : m.toUpperCase()}
            </button>
          ))}
          {modeOverride !== "auto" && (
            <span role="status" className="text-[11px] text-neutral-500 basis-full sm:basis-auto">Forced {modeOverride.toUpperCase()} — switch to Auto for smart routing</span>
          )}
        </div>
        <form
          aria-label="Message copilot"
          onSubmit={(e) => {
            e.preventDefault();
            void handleRunQuery(inputQuery);
          }}
          className="flex items-center gap-2 relative max-w-4xl mx-auto"
        >
          <label htmlFor="copilot-input" className="sr-only">
            Message Tracc
          </label>
          <input
            id="copilot-input"
            type="text"
            autoComplete="off"
            placeholder="Message Tracc… ask about loads, carriers, risk, or SOPs"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isProcessing}
            className="flex-1 min-w-0 px-4 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 outline-none focus:border-neutral-400 dark:focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors disabled:opacity-60"
          />
          {isProcessing ? (
            <button
              type="button"
              onClick={handleStop}
              title="Stop response"
              aria-label="Stop response"
              className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium text-xs sm:text-sm hover:bg-red-700 transition-colors flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="px-4 py-2.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium text-xs sm:text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
            >
              <span>Ask</span>
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
