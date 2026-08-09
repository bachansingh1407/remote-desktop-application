"use client";

import { useMemo, useState } from "react";
import { Folder, FileText, ImageIcon, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useFileSystemStore } from "@/app/stores";

function NodeIcon({ node }) {
  if (node.type === "folder") return <Folder size={14} />;
  if (node.imported && node.mimeType?.startsWith("image/")) return <ImageIcon size={14} />;
  return <FileText size={14} />;
}

function formatTrashedDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TrashApp() {
  // Select `items` directly (not the derived getter) so this component
  // actually re-renders whenever the store's items change — calling
  // getTrashedNodes() through a selector works too, but deriving from the
  // raw `items` slice with useMemo is the more idiomatic zustand pattern
  // and avoids recomputing on unrelated store updates.
  const items = useFileSystemStore((s) => s.items);
  const restoreNode = useFileSystemStore((s) => s.restoreNode);
  const deleteForever = useFileSystemStore((s) => s.deleteForever);
  const emptyTrash = useFileSystemStore((s) => s.emptyTrash);

  const [selected, setSelected] = useState(null);

  const trashed = useMemo(
    () =>
      Object.values(items)
        .filter((n) => n.trashed)
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [items]
  );

  const handleDeleteForever = (id) => {
    if (window.confirm("Delete this permanently? This can't be undone.")) {
      deleteForever(id);
      setSelected((s) => (s === id ? null : s));
    }
  };

  const handleEmptyTrash = () => {
    if (trashed.length === 0) return;
    if (window.confirm(`Permanently delete all ${trashed.length} item(s) in trash?`)) {
      emptyTrash();
      setSelected(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 bg-background p-4 text-foreground">
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-xs text-foreground-secondary">
          {trashed.length} item{trashed.length !== 1 ? "s" : ""} in trash
        </p>
        <button
          onClick={handleEmptyTrash}
          disabled={trashed.length === 0}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
            trashed.length === 0
              ? "cursor-not-allowed text-foreground-secondary/40"
              : "text-red-500 hover:bg-red-500/10"
          }`}
        >
          <XCircle size={13} />
          Empty trash
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {trashed.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 text-foreground-secondary/60">
              <Trash2 size={22} />
            </span>
            <p className="text-xs text-foreground-secondary">Trash is empty</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {trashed.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelected(node.id)}
                className={`flex items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0 transition-colors ${
                  selected === node.id ? "bg-accent/10" : "hover:bg-foreground/5"
                }`}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ backgroundColor: node.type === "folder" ? "#22d3ee" : "#f5b942" }}
                >
                  <NodeIcon node={node} />
                </span>

                <span className="flex-1 truncate text-sm">{node.name}</span>

                <span className="hidden shrink-0 text-[11px] text-foreground-secondary sm:block">
                  {formatTrashedDate(node.trashedAt)}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreNode(node.id);
                  }}
                  title="Restore"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary hover:bg-foreground/10 hover:text-foreground"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteForever(node.id);
                  }}
                  title="Delete forever"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}