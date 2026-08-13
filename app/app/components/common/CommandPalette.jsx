"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, CornerDownLeft, Folder, FileText, LayoutGrid } from "lucide-react";
import { useWindowStore, useFileSystemStore } from "@/app/stores";
import { APP_REGISTRY, useAllApps } from "@/app/lib/appRegistry";
import dynamic from "next/dynamic";
import FileEditor from "./FileEditor";

const FileViewer = dynamic(() => import("./FileViewer"), { ssr: false });

// Global Ctrl/Cmd+K launcher. Search apps and files/folders from one place,
// keyboard-navigable, opens whatever you pick. Also reachable from the
// taskbar's search icon (see Taskbar.jsx).
let paletteOpenSetter = null;
export function openCommandPalette() {
  paletteOpenSetter?.();
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const openWindow = useWindowStore((s) => s.openWindow);
  const items = useFileSystemStore((s) => s.items);
  const getPath = useFileSystemStore((s) => s.getPath);

  // Resets happen right where "open" is requested, not as a reaction to it —
  // avoids the cascading-render footgun of setState-inside-an-effect while
  // still guaranteeing a fresh search every time the palette appears.
  const showPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    paletteOpenSetter = showPalette;
    return () => {
      paletteOpenSetter = null;
    };
  }, [showPalette]);

  useEffect(() => {
    const handler = (e) => {
      const isK = e.key?.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => {
          if (v) return false;
          showPalette();
          return true;
        });
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, showPalette]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const allApps = useAllApps();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const appResults = allApps.filter((a) => !a.comingSoon && a.component)
      .filter((a) => !q || a.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((a) => ({ kind: "app", id: `app-${a.id}`, app: a }));

    const fileResults = q
      ? Object.values(items)
          .filter((n) => !n.trashed && n.name.toLowerCase().includes(q))
          .slice(0, 8)
          .map((n) => ({ kind: "node", id: `node-${n.id}`, node: n }))
      : [];

    return [...appResults, ...fileResults];
  }, [query, items, allApps]);

  const launchApp = useCallback(
    (app) => {
      openWindow({
        id: app.id,
        title: app.title,
        content: <app.component />,
        width: app.width,
        height: app.height,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
      });
      setOpen(false);
    },
    [openWindow]
  );

  const openNode = useCallback(
    (node) => {
      if (node.type === "folder") {
        const filesApp = APP_REGISTRY.find((a) => a.id === "files");
        launchApp(filesApp);
        return;
      }
      openWindow({
        id: `file-${node.id}`,
        title: node.name,
        content: node.imported ? <FileViewer fileId={node.id} /> : <FileEditor fileId={node.id} />,
        width: 720,
        height: 520,
      });
      setOpen(false);
    },
    [launchApp, openWindow]
  );

  const activate = useCallback(
    (result) => {
      if (!result) return;
      if (result.kind === "app") launchApp(result.app);
      else openNode(result.node);
    },
    [launchApp, openNode]
  );

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(results[activeIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10005] flex items-start justify-center bg-black/25 pt-[14vh] backdrop-blur-[2px] animate-fade-in"
      onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-background-elevated
                   shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 animate-scale-in"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-foreground-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search apps and files..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder-foreground-secondary/60"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground-secondary/70 sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-foreground-secondary">
              Nothing matches &quot;{query}&quot;
            </p>
          ) : (
            results.map((r, i) => (
              <ResultRow
                key={r.id}
                result={r}
                active={i === activeIndex}
                onHover={() => setActiveIndex(i)}
                onClick={() => activate(r)}
                getPath={getPath}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10.5px] text-foreground-secondary/70">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft size={11} /> to open
          </span>
          <span>↑↓ to navigate</span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ result, active, onHover, onClick, getPath }) {
  if (result.kind === "app") {
    const { app } = result;
    return (
      <button
        onMouseEnter={onHover}
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors
          ${active ? "bg-accent/15" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}`}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: app.color ?? "#6B7280" }}
        >
          <app.icon size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{app.title}</span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-foreground-secondary/60">
          <LayoutGrid size={10} /> App
        </span>
      </button>
    );
  }

  const { node } = result;
  const folderPath = getPath(node.id).slice(0, -1);
  return (
    <button
      onMouseEnter={onHover}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors
        ${active ? "bg-accent/15" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: node.type === "folder" ? "#22d3ee" : "#f5b942" }}
      >
        {node.type === "folder" ? <Folder size={13} /> : <FileText size={13} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{node.name}</span>
      <span className="max-w-[35%] shrink-0 truncate text-[10px] text-foreground-secondary/60">
        {folderPath.length === 0 ? "Home" : folderPath.map((f) => f.name).join(" / ")}
      </span>
    </button>
  );
}