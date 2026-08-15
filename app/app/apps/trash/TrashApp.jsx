"use client";

import { useMemo, useState } from "react";
import { Folder, FileText, ImageIcon, RotateCcw, Trash2, Clock } from "lucide-react";
import { useFileSystemStore } from "@/app/stores";

function NodeIcon({ node }) {
  if (node.type === "folder") return <Folder size={16} strokeWidth={1.75} />;
  if (node.imported && node.mimeType?.startsWith("image/")) return <ImageIcon size={16} strokeWidth={1.75} />;
  return <FileText size={16} strokeWidth={1.75} />;
}

function iconColor(node) {
  if (node.type === "folder") return "#0A84FF";
  if (node.imported && node.mimeType?.startsWith("image/")) return "#A855F7";
  return "#8E8E93";
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatSize(bytes) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

// Buckets items into Today / Yesterday / This Week / Earlier, mirroring
// how macOS Photos & Mail group by recency — deletion time is real
// ordered content here, not decoration.
function groupByRecency(nodes) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - 6 * 86400000;

  const buckets = { Today: [], Yesterday: [], "This Week": [], Earlier: [] };
  for (const n of nodes) {
    const t = n.trashedAt ?? 0;
    if (t >= startOfToday) buckets.Today.push(n);
    else if (t >= startOfYesterday) buckets.Yesterday.push(n);
    else if (t >= startOfWeek) buckets["This Week"].push(n);
    else buckets.Earlier.push(n);
  }
  return Object.entries(buckets).filter(([, list]) => list.length > 0);
}

function Row({ node, isSelected, onSelect, onRestore, onDelete }) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onRestore}
      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
        isSelected ? "bg-accent/15" : "hover:bg-foreground/[0.04]"
      }`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${iconColor(node)}1A`, color: iconColor(node) }}
      >
        <NodeIcon node={node} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-tight">{node.name}</p>
        <p className="truncate text-[11px] leading-tight text-foreground-secondary">
          {node.trashedAt ? formatTime(node.trashedAt) : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestore();
          }}
          title="Put back"
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary hover:bg-foreground/10 hover:text-foreground"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete immediately"
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function TrashApp() {
  const items = useFileSystemStore((s) => s.items);
  const restoreNode = useFileSystemStore((s) => s.restoreNode);
  const deleteForever = useFileSystemStore((s) => s.deleteForever);
  const emptyTrash = useFileSystemStore((s) => s.emptyTrash);

  const [selected, setSelected] = useState(null);
  // confirm: null | { kind: "one", id, name } | { kind: "all", count }
  const [confirm, setConfirm] = useState(null);

  const trashed = useMemo(
    () =>
      Object.values(items)
        .filter((n) => n.trashed)
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [items]
  );

  const groups = useMemo(() => groupByRecency(trashed), [trashed]);

  const selectedNode = trashed.find((n) => n.id === selected) ?? null;

  const totalSize = useMemo(
    () => trashed.reduce((sum, n) => sum + (typeof n.size === "number" ? n.size : 0), 0),
    [trashed]
  );

  const requestDeleteForever = (node) => setConfirm({ kind: "one", id: node.id, name: node.name });
  const requestEmptyTrash = () => {
    if (trashed.length === 0) return;
    setConfirm({ kind: "all", count: trashed.length });
  };

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "one") {
      deleteForever(confirm.id);
      setSelected((s) => (s === confirm.id ? null : s));
    } else {
      emptyTrash();
      setSelected(null);
    }
    setConfirm(null);
  };

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* Toolbar — no page title here, the window chrome already says "Trash" */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-2.5">
        <p className="text-[11px] text-foreground-secondary">
          {trashed.length === 0
            ? "No items"
            : `${trashed.length} item${trashed.length !== 1 ? "s" : ""}${
                totalSize > 0 ? ` · ${formatSize(totalSize)}` : ""
              }`}
        </p>
        <button
          onClick={requestEmptyTrash}
          disabled={trashed.length === 0}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            trashed.length === 0
              ? "cursor-not-allowed text-foreground-secondary/40"
              : "text-red-500 hover:bg-red-500/10 active:bg-red-500/15"
          }`}
        >
          Empty Trash
        </button>
      </div>

      {/* List, grouped by when things were deleted */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {trashed.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-foreground/[0.04] text-foreground-secondary/50">
              <Trash2 size={26} strokeWidth={1.5} />
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground-secondary">Trash is empty</p>
              <p className="text-[11px] text-foreground-secondary/60">Deleted items will show up here</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(([label, nodes]) => (
              <div key={label}>
                <p className="sticky top-0 z-[1] bg-background px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-secondary/70">
                  {label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {nodes.map((node) => (
                    <Row
                      key={node.id}
                      node={node}
                      isSelected={selected === node.id}
                      onSelect={() => setSelected(node.id)}
                      onRestore={() => restoreNode(node.id)}
                      onDelete={() => requestDeleteForever(node)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: selection info, or the standing auto-delete notice */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-2 text-[11px] text-foreground-secondary">
        {selectedNode ? (
          <>
            <span className="truncate">{selectedNode.name}</span>
            <span className="shrink-0">
              {formatSize(selectedNode.size) ?? (selectedNode.type === "folder" ? "Folder" : "File")}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-foreground-secondary/60">
            <Clock size={11} />
            Items in Trash are kept until you empty it
          </span>
        )}
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]"
          onClick={() => setConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-6 w-full max-w-[280px] rounded-xl border border-border/60 bg-background p-4 shadow-xl"
          >
            <p className="text-[13px] font-medium">
              {confirm.kind === "one" ? `Delete "${confirm.name}" permanently?` : `Empty Trash?`}
            </p>
            <p className="mt-1 text-[11px] text-foreground-secondary">
              {confirm.kind === "one"
                ? "This item can't be recovered once deleted."
                : `This will permanently delete ${confirm.count} item${confirm.count !== 1 ? "s" : ""}. This can't be undone.`}
            </p>
            <div className="mt-3.5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                onClick={runConfirm}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}