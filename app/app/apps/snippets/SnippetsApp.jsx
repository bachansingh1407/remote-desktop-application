"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Copy, Check, Code2, Search } from "lucide-react";
import { useSnippetsStore, LANGUAGES } from "@/app/stores";

export default function SnippetsApp() {
  const snippets = useSnippetsStore((s) => s.snippets);
  const addSnippet = useSnippetsStore((s) => s.addSnippet);
  const updateSnippet = useSnippetsStore((s) => s.updateSnippet);
  const deleteSnippet = useSnippetsStore((s) => s.deleteSnippet);

  const [activeId, setActiveId] = useState(snippets[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return snippets;
    return snippets.filter(
      (s) => s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [snippets, query]);

  const active = snippets.find((s) => s.id === activeId) ?? filtered[0] ?? null;

  const handleNew = () => {
    const id = addSnippet({ title: "Untitled snippet", language: "javascript", code: "" });
    setActiveId(id);
  };

  const handleCopy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard permission denied — silently ignore, nothing destructive happened
    }
  };

  const handleDelete = (id) => {
    deleteSnippet(id);
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="flex h-full bg-background text-foreground">
      {/* list */}
      <div className="flex w-52 shrink-0 flex-col border-r border-border">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border p-2">
          <div className="relative flex-1">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-foreground-secondary/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full rounded-md border border-border bg-black/[0.03] dark:bg-white/[0.04] py-1.5 pl-6 pr-2 text-[11px] outline-none focus:border-accent/50"
            />
          </div>
          <button
            onClick={handleNew}
            title="New snippet"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent hover:bg-accent/25"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-foreground-secondary/60">
              No snippets yet
            </p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors
                  ${active?.id === s.id ? "bg-accent/15" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}`}
              >
                <Code2 size={12} className="shrink-0 text-foreground-secondary/60" />
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-foreground">{s.title}</span>
                <span className="shrink-0 rounded bg-black/[0.05] px-1 py-0.5 text-[9px] text-foreground-secondary/70 dark:bg-white/[0.07]">
                  {s.language}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* editor */}
      {active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-2.5">
            <input
              value={active.title}
              onChange={(e) => updateSnippet(active.id, { title: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none"
            />
            <select
              value={active.language}
              onChange={(e) => updateSnippet(active.id, { language: e.target.value })}
              className="shrink-0 rounded-md border border-border bg-background-secondary/40 px-2 py-1 text-[11px] text-foreground outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <button
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1 rounded-md bg-black/[0.05] dark:bg-white/[0.06] px-2.5 py-1.5 text-[11px] text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => handleDelete(active.id)}
              className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-foreground-secondary hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 size={13} />
            </button>
          </div>

          <textarea
            value={active.code}
            onChange={(e) => updateSnippet(active.id, { code: e.target.value })}
            spellCheck={false}
            placeholder="Paste or write your snippet here..."
            className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[12.5px] leading-relaxed text-foreground outline-none placeholder-foreground-secondary/50"
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 text-foreground-secondary/60">
            <Code2 size={20} />
          </span>
          <p className="text-xs text-foreground-secondary">No snippet selected</p>
          <button onClick={handleNew} className="text-[11px] text-accent hover:underline">
            Create one
          </button>
        </div>
      )}
    </div>
  );
}
