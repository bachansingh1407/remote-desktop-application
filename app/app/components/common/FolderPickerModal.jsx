"use client";

import { useState, useMemo } from "react";
import { Folder, FileText, ChevronRight, Home, FolderPlus, X } from "lucide-react";
import { useFileSystemStore } from "@/app/stores";

/**
 * A "Save As"-style folder browser: navigate the workspace tree, create a
 * new folder inline (no prompt()), and confirm a destination + filename.
 * Used by the Write app, but generic enough for any "pick a location" flow.
 */
export default function FolderPickerModal({
  open,
  onClose,
  onConfirm,
  onSelectFile,
  initialFolderId = null,
  initialFilename = "Untitled",
  confirmLabel = "Save",
  title = "Save file",
  mode = "save", // "save" | "open"
}) {
  const getChildren = useFileSystemStore((s) => s.getChildren);
  const getPath = useFileSystemStore((s) => s.getPath);
  const createFolder = useFileSystemStore((s) => s.createFolder);

  const [folderId, setFolderId] = useState(initialFolderId);
  const [filename, setFilename] = useState(initialFilename);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("New folder");

  const children = useMemo(() => getChildren(folderId), [getChildren, folderId, open]);
  const path = useMemo(() => getPath(folderId), [getPath, folderId, open]);
  const folders = children.filter((n) => n.type === "folder");
  const files = children.filter((n) => n.type === "file");

  if (!open) return null;

  const commitNewFolder = async () => {
    const name = newFolderName.trim();
    setCreating(false);
    if (!name) return;
    const id = await createFolder(folderId, name);
    if (id) setFolderId(id);
  };

  const handleConfirm = () => {
    if (!filename.trim()) return;
    onConfirm({ folderId, filename: filename.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-[10004] flex items-center justify-center bg-black/35 backdrop-blur-[2px] animate-fade-in"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[80vh] w-[440px] flex-col overflow-hidden rounded-2xl border border-border
                      bg-background-elevated shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 animate-scale-in">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <button onClick={onClose} className="rounded-md p-1 text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]">
            <X size={14} />
          </button>
        </div>

        {/* breadcrumb */}
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-border px-3 py-2 text-[11px] text-foreground-secondary">
          <button
            onClick={() => setFolderId(null)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06]
              ${folderId === null ? "font-medium text-foreground" : ""}`}
          >
            <Home size={11} /> Workspace
          </button>
          {path.map((n) => (
            <span key={n.id} className="flex items-center gap-0.5">
              <ChevronRight size={10} className="text-foreground-secondary/40" />
              <button
                onClick={() => setFolderId(n.id)}
                className={`truncate rounded-md px-2 py-1 transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06]
                  ${n.id === folderId ? "font-medium text-foreground" : ""}`}
              >
                {n.name}
              </button>
            </span>
          ))}
        </div>

        {/* folder contents */}
        <div className="min-h-[180px] flex-1 overflow-y-auto p-2">
          {creating && (
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-accent/[0.06] px-2 py-1.5 ring-1 ring-inset ring-accent/40">
              <Folder size={14} className="shrink-0 text-cyan-500" />
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={commitNewFolder}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitNewFolder(); }
                  if (e.key === "Escape") setCreating(false);
                }}
                className="min-w-0 flex-1 rounded border border-accent/50 bg-background px-1.5 py-0.5 text-[12.5px] outline-none"
              />
            </div>
          )}

          {folders.length === 0 && files.length === 0 && !creating ? (
            <p className="py-8 text-center text-[11px] text-foreground-secondary/60">This folder is empty</p>
          ) : (
            <>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFolderId(f.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                >
                  <Folder size={14} className="shrink-0 text-cyan-500" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{f.name}</span>
                  <ChevronRight size={12} className="shrink-0 text-foreground-secondary/40" />
                </button>
              ))}
              {files.map((f) => (
                <div
                  key={f.id}
                  onClick={mode === "open" ? () => onSelectFile(f) : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left
                    ${mode === "open" ? "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.05]" : "opacity-45"}`}
                >
                  <FileText size={14} className="shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{f.name}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <button
          onClick={() => { setCreating(true); setNewFolderName("New folder"); }}
          className="flex shrink-0 items-center gap-1.5 border-t border-border px-4 py-2 text-[11.5px] text-accent hover:bg-accent/[0.06]"
        >
          <FolderPlus size={13} /> New folder here
        </button>

        {/* filename + actions */}
        {mode === "save" && (
          <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              placeholder="File name"
              className="min-w-0 flex-1 rounded-lg border border-border bg-black/[0.03] px-3 py-2 text-[12.5px]
                         text-foreground outline-none focus:border-accent/50 dark:bg-white/[0.04]"
            />
            <button
              onClick={handleConfirm}
              disabled={!filename.trim()}
              className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-medium text-white
                         hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        )}
        {mode === "open" && files.length === 0 && folders.length === 0 && !creating && (
          <p className="shrink-0 border-t border-border px-4 py-3 text-center text-[11px] text-foreground-secondary/55">
            Nothing to open in this folder
          </p>
        )}
      </div>
    </div>
  );
}
