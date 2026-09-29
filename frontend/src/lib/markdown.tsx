// Minimal markdown renderer for AI answers (headings, bullets, numbered
// lists, bold, inline code). Keeps backend markdown readable.
import React from "react";

function inlineMd(text: string, base: string): React.ReactNode[] {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**")) {
      return <b key={`${base}-${i}`}>{p.slice(2, -2)}</b>;
    }
    if (p.length > 2 && p.startsWith("`") && p.endsWith("`")) {
      return (
        <code
          key={`${base}-${i}`}
          className="rounded bg-neutral-900/10 px-1 py-0.5 font-mono text-[12px] dark:bg-white/15"
        >
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${base}-${i}`}>{p}</span>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = String(text ?? "").split("\n");
  const blocks: (
    | { t: "h"; level: number; text: string }
    | { t: "list"; ordered: boolean; items: string[] }
    | { t: "p"; text: string }
  )[] = [];
  let list: { t: "list"; ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, "");
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ t: "h", level: h[1].length, text: h[2] });
    } else if (ul) {
      if (!list || list.ordered) {
        flush();
        list = { t: "list", ordered: false, items: [] };
      }
      list.items.push(ul[1]);
    } else if (ol) {
      if (!list || !list.ordered) {
        flush();
        list = { t: "list", ordered: true, items: [] };
      }
      list.items.push(ol[1]);
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      blocks.push({ t: "p", text: line });
    }
  });
  flush();
  return (
    <div className="space-y-2 leading-relaxed">
      {blocks.map((b, i) => {
        if (b.t === "h") {
          return (
            <p
              key={i}
              className={b.level === 1 ? "text-base font-bold" : "text-sm font-bold"}
            >
              {inlineMd(b.text, `h${i}`)}
            </p>
          );
        }
        if (b.t === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag
              key={i}
              className={b.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}
            >
              {b.items.map((it, j) => (
                <li key={j}>{inlineMd(it, `li${i}-${j}`)}</li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{inlineMd(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
