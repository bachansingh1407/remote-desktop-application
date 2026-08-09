"use client";

import { useState, useRef, useEffect } from "react";
import {
  Folder, FileText, FolderPlus, FilePlus2, ChevronRight,
  Trash2, LayoutGrid, ListIcon, Home, Upload, FileSpreadsheet, FileImage,
  Pencil, Copy, FolderInput, Search, X, FolderOpen,
} from "lucide-react";
import { useFileSystemStore, useWindowStore } from "@/app/stores";
import { toast } from "@/app/stores/useToastStore";
import { useContextMenu } from "@/app/components/common/ContextMenu";
import FileEditor from "@/app/components/common/FileEditor";
import dynamic from "next/dynamic";

const FileViewer = dynamic(() => import("@/app/components/common/FileViewer"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-foreground-secondary/50">Loading viewer...</div>,
});

export default function FilesApp({ initialFolderId = null }) {
  const getChildren = useFileSystemStore((s) => s.getChildren);
  const getPath = useFileSystemStore((s) => s.getPath);
  const createFolder = useFileSystemStore((s) => s.createFolder);
  const createFile = useFileSystemStore((s) => s.createFile);
  const importFile = useFileSystemStore((s) => s.importFile);
  const trashNode = useFileSystemStore((s) => s.trashNode);
  const renameNode = useFileSystemStore((s) => s.renameNode);
  const duplicateNode = useFileSystemStore((s) => s.duplicateNode);
  const moveNode = useFileSystemStore((s) => s.moveNode);
  const searchNodes = useFileSystemStore((s) => s.searchNodes);
  const items = useFileSystemStore((s) => s.items);

  const openWindow = useWindowStore((s) => s.openWindow);
  const { openMenu } = useContextMenu();

  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("grid");
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef(null);

  // Inline "create" row — no window.prompt() modal. Clicking "New folder"/
  // "New file" drops a live editable tile straight into the grid, exactly
  // where the new item will land, and Enter/blur commits it via the store.
  const [creating, setCreating] = useState(null); // { type: "folder" | "file" } | null
  const [creatingName, setCreatingName] = useState("");

  // Inline rename — same idea, replaces the old window.prompt() rename flow.
  const [renamingId, setRenamingId] = useState(null);
  const [renamingValue, setRenamingValue] = useState("");

  const localChildren = getChildren(currentFolderId);
  const searchResults = query.trim() ? searchNodes(query) : null;
  const children = searchResults ?? localChildren;
  const isSearching = searchResults !== null;
  const path = getPath(currentFolderId);
  const folderCount = children.filter((n) => n.type === "folder").length;
  const fileCount = children.filter((n) => n.type === "file").length;

  const startCreate = (type) => {
    setCreating({ type });
    setCreatingName(type === "folder" ? "New folder" : "New note");
  };

  const commitCreate = async () => {
    if (!creating) return;
    const name = creatingName.trim();
    setCreating(null);
    if (!name) return;
    try {
      if (creating.type === "folder") {
        await createFolder(currentFolderId, name);
      } else {
        await createFile(currentFolderId, name, "");
      }
    } catch (err) {
      toast.error("Couldn't create item", err.response?.data?.message || err.message);
    }
  };

  const cancelCreate = () => setCreating(null);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        await importFile(currentFolderId, file);
      } catch (err) {
        toast.error(`Couldn't import "${file.name}"`, err.response?.data?.message || err.message);
      }
    }
    e.target.value = "";
  };

  const openNode = (node) => {
    if (node.type === "folder") {
      setCurrentFolderId(node.id);
      setSelected(null);
      return;
    }
    if (node.imported) {
      openWindow({ id: `file-${node.id}`, title: node.name, content: <FileViewer fileId={node.id} />, width: 760, height: 560 });
      return;
    }
    openWindow({ id: `file-${node.id}`, title: node.name, content: <FileEditor fileId={node.id} />, width: 700, height: 480 });
  };

  const startRename = (node) => {
    setRenamingId(node.id);
    setRenamingValue(node.name);
  };

  const commitRename = async (node) => {
    const name = renamingValue.trim();
    setRenamingId(null);
    if (!name || name === node.name) return;
    try {
      await renameNode(node.id, name);
    } catch (err) {
      toast.error("Couldn't rename", err.response?.data?.message || err.message);
    }
  };

  const buildNodeMenu = (node) => [
    { label: "Open", onClick: () => openNode(node) },
    { divider: true },
    { label: "Rename", icon: Pencil, onClick: () => startRename(node) },
    { label: "Duplicate", icon: Copy, onClick: () => duplicateNode(node.id) },
    { label: "Move to Home", icon: FolderInput, onClick: () => moveNode(node.id, null), disabled: node.parentId === null },
    { divider: true },
    { label: "Move to Trash", icon: Trash2, danger: true, onClick: () => trashNode(node.id) },
  ];

  const buildEmptyAreaMenu = () => [
    { label: "New folder", icon: FolderPlus, onClick: () => startCreate("folder") },
    { label: "New file", icon: FilePlus2, onClick: () => startCreate("file") },
    { label: "Import...", icon: Upload, onClick: handleImportClick },
  ];

  const handleNodeContextMenu = (e, node) => openMenu(e, buildNodeMenu(node));
  const handleBackgroundContextMenu = (e) => openMenu(e, buildEmptyAreaMenu());

  const handleDragStart = (e, node) => {
    setDraggedId(node.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };
  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    if (targetId === draggedId) return;
    setDragOverId(targetId);
  };
  const handleDrop = (e, targetNode) => {
    e.preventDefault();
    const targetId = targetNode?.id ?? null;
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    if (targetNode && targetNode.type !== "folder") { setDraggedId(null); setDragOverId(null); return; }
    if (targetNode) {
      const targetPath = getPath(targetNode.id).map((n) => n.id);
      if (targetPath.includes(draggedId)) { setDraggedId(null); setDragOverId(null); return; }
    }
    moveNode(draggedId, targetId);
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* header */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-sm dark:shadow-[0_1px_0_rgba(255,255,255,0.03)]">
        {/* breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 text-xs text-foreground-secondary">
          <button
            onClick={() => setCurrentFolderId(null)}
            onDragOver={(e) => handleDragOver(e, "home")}
            onDrop={(e) => handleDrop(e, null)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 font-medium transition-colors
              ${dragOverId === "home" ? "bg-accent/15 text-accent" : "hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.06]"}`}
          >
            <Home size={13} />
            Workspace
          </button>
          {path.map((node, i) => (
            <span key={node.id} className="flex min-w-0 items-center gap-0.5">
              <ChevronRight size={12} className="shrink-0 text-foreground-secondary/35" />
              <button
                onClick={() => setCurrentFolderId(node.id)}
                onDragOver={(e) => handleDragOver(e, node.id)}
                onDrop={(e) => handleDrop(e, node)}
                className={`truncate rounded-md px-2 py-1.5 transition-colors
                  ${dragOverId === node.id ? "bg-accent/15 text-accent" : "hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/[0.06]"}
                  ${i === path.length - 1 ? "font-medium text-foreground" : ""}`}
              >
                {node.name}
              </button>
            </span>
          ))}
        </div>

        {/* search */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-black/[0.025] px-2.5 py-1.5 transition-colors focus-within:border-accent/40 dark:bg-white/[0.04]">
          <Search size={13} className="shrink-0 text-foreground-secondary/55" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspace..."
            className="w-36 bg-transparent text-xs text-foreground outline-none placeholder-foreground-secondary/55"
          />
          {query && (
            <button onClick={() => setQuery("")} className="shrink-0 text-foreground-secondary/55 hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        {/* icon-only actions */}
        <HeaderIconButton icon={FolderPlus} label="New folder" onClick={() => startCreate("folder")} disabled={isSearching} />
        <HeaderIconButton icon={FilePlus2} label="New file" onClick={() => startCreate("file")} disabled={isSearching} />
        <HeaderIconButton icon={Upload} label="Import files" onClick={handleImportClick} disabled={isSearching} />
        <input ref={fileInputRef} type="file" multiple onChange={handleFilesSelected} className="hidden" />

        <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />

        {/* view toggle */}
        <div className="flex shrink-0 items-center rounded-lg border border-border p-0.5">
          <button onClick={() => setView("grid")} title="Grid view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors
              ${view === "grid" ? "bg-accent text-white shadow-sm" : "text-foreground-secondary/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}>
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => setView("list")} title="List view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors
              ${view === "list" ? "bg-accent text-white shadow-sm" : "text-foreground-secondary/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}>
            <ListIcon size={13} />
          </button>
        </div>
      </div>

      {/* contents */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {children.length === 0 && !creating ? (
          <EmptyState searching={isSearching} />
        ) : view === "grid" ? (
          <GridView
            items={children} selected={selected} onSelect={setSelected} onOpen={openNode}
            onContextMenu={handleNodeContextMenu} onBackgroundContextMenu={handleBackgroundContextMenu}
            draggedId={draggedId} dragOverId={dragOverId} onDragStart={handleDragStart} onDragEnd={handleDragEnd}
            onDragOver={handleDragOver} onDrop={handleDrop} currentFolderId={currentFolderId}
            getPath={getPath} isSearching={isSearching}
            creating={creating} creatingName={creatingName} onCreatingNameChange={setCreatingName}
            onCommitCreate={commitCreate} onCancelCreate={cancelCreate}
            renamingId={renamingId} renamingValue={renamingValue} onRenamingChange={setRenamingValue}
            onCommitRename={commitRename} onCancelRename={() => setRenamingId(null)}
          />
        ) : (
          <ListView
            items={children} selected={selected} onSelect={setSelected} onOpen={openNode} onContextMenu={handleNodeContextMenu}
            creating={creating} creatingName={creatingName} onCreatingNameChange={setCreatingName}
            onCommitCreate={commitCreate} onCancelCreate={cancelCreate}
            renamingId={renamingId} renamingValue={renamingValue} onRenamingChange={setRenamingValue}
            onCommitRename={commitRename} onCancelRename={() => setRenamingId(null)}
          />
        )}
      </div>

      {/* footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-foreground-secondary/70">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Folder size={11} className="text-foreground-secondary/50" /> {folderCount}</span>
          <span className="flex items-center gap-1"><FileText size={11} className="text-foreground-secondary/50" /> {fileCount}</span>
        </span>
        {isSearching && <span className="text-accent">{children.length} result{children.length !== 1 ? "s" : ""} for &quot;{query}&quot;</span>}
      </div>
    </div>
  );
}

function HeaderIconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-secondary
                 transition-colors hover:bg-black/[0.05] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06]">
      <Icon size={14} />
    </button>
  );
}

// Shared inline text input used both for the "creating a new item" tile and
// for renaming an existing one — commits on blur/Enter, cancels on Escape.
function InlineNameInput({ value, onChange, onCommit, onCancel, className }) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onClick={(e) => e.stopPropagation()}
      className={className}
    />
  );
}

function GridView({
  items, selected, onSelect, onOpen, onContextMenu, onBackgroundContextMenu,
  draggedId, dragOverId, onDragStart, onDragEnd, onDragOver, onDrop, currentFolderId, getPath, isSearching,
  creating, creatingName, onCreatingNameChange, onCommitCreate, onCancelCreate,
  renamingId, renamingValue, onRenamingChange, onCommitRename, onCancelRename,
}) {
  return (
    <div
      onContextMenu={onBackgroundContextMenu}
      onClick={() => onSelect(null)}
      onDragOver={(e) => onDragOver(e, "empty-area")}
      onDrop={(e) => onDrop(e, currentFolderId ? { id: currentFolderId, type: "folder" } : null)}
      className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-2 gap-y-4 content-start min-h-full"
    >
      {creating && (
        <div className="flex flex-col items-center gap-2 rounded-xl p-2.5 text-center ring-1 ring-inset ring-accent/40 bg-accent/[0.06]">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: creating.type === "folder" ? "#22d3ee" : "#f5b942" }}
          >
            {creating.type === "folder" ? <Folder size={19} strokeWidth={1.8} /> : <FileText size={19} strokeWidth={1.8} />}
          </span>
          <InlineNameInput
            value={creatingName}
            onChange={onCreatingNameChange}
            onCommit={onCommitCreate}
            onCancel={onCancelCreate}
            className="w-full rounded border border-accent/50 bg-background px-1 py-0.5 text-center text-[11.5px] font-medium text-foreground outline-none"
          />
        </div>
      )}

      {items.map((node) => {
        const { icon: Icon, color } = node.type === "folder" ? { icon: Folder, color: "#22d3ee" } : getFileVisualSafe(node);
        const isDragging = draggedId === node.id;
        const isDropTarget = node.type === "folder" && dragOverId === node.id;
        const isRenaming = renamingId === node.id;
        const folderPath = isSearching ? getPath(node.id).slice(0, -1) : null;

        return (
          <button
            key={node.id}
            draggable={!isRenaming}
            onDragStart={(e) => onDragStart(e, node)}
            onDragEnd={onDragEnd}
            onDragOver={node.type === "folder" ? (e) => { e.stopPropagation(); onDragOver(e, node.id); } : undefined}
            onDrop={node.type === "folder" ? (e) => { e.stopPropagation(); onDrop(e, node); } : undefined}
            onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
            onDoubleClick={() => !isRenaming && onOpen(node)}
            onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, node); }}
            className={`group flex flex-col items-center gap-2 rounded-xl p-2.5 text-center transition-all duration-150
              ${isDragging ? "opacity-40" : ""}
              ${isDropTarget ? "bg-accent/15 ring-2 ring-inset ring-accent/50 scale-[1.04]"
                : selected === node.id ? "bg-accent/[0.08] ring-1 ring-inset ring-accent/30"
                : "hover:bg-black/[0.035] dark:hover:bg-white/[0.045]"}`}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white transition-transform duration-150"
              style={{ backgroundColor: color }}
            >
              <Icon size={19} strokeWidth={1.8} />
            </span>
            {isRenaming ? (
              <InlineNameInput
                value={renamingValue}
                onChange={onRenamingChange}
                onCommit={() => onCommitRename(node)}
                onCancel={onCancelRename}
                className="w-full rounded border border-accent/50 bg-background px-1 py-0.5 text-center text-[11.5px] font-medium text-foreground outline-none"
              />
            ) : (
              <span className="line-clamp-2 w-full break-words text-[11.5px] font-medium leading-tight text-foreground">{node.name}</span>
            )}
            {isSearching && !isRenaming && (
              <span className="w-full truncate text-[10px] text-foreground-secondary/55">
                {folderPath.length === 0 ? "Home" : folderPath.map((f) => f.name).join(" / ")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ListView({
  items, selected, onSelect, onOpen, onContextMenu,
  creating, creatingName, onCreatingNameChange, onCommitCreate, onCancelCreate,
  renamingId, renamingValue, onRenamingChange, onCommitRename, onCancelRename,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-black/[0.02] px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-foreground-secondary/60 dark:bg-white/[0.03]">
        <span className="flex-1">Name</span>
        <span className="w-20 text-right">Type</span>
      </div>

      {creating && (
        <div className="flex w-full items-center gap-3 border-b border-border/50 bg-accent/[0.06] px-3.5 py-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: creating.type === "folder" ? "#22d3ee" : "#f5b942" }}
          >
            {creating.type === "folder" ? <Folder size={13} strokeWidth={1.9} /> : <FileText size={13} strokeWidth={1.9} />}
          </span>
          <InlineNameInput
            value={creatingName}
            onChange={onCreatingNameChange}
            onCommit={onCommitCreate}
            onCancel={onCancelCreate}
            className="flex-1 rounded border border-accent/50 bg-background px-1.5 py-0.5 text-[13px] text-foreground outline-none"
          />
        </div>
      )}

      {items.map((node) => {
        const { icon: Icon, color } = node.type === "folder" ? { icon: Folder, color: "#22d3ee" } : getFileVisualSafe(node);
        const isRenaming = renamingId === node.id;
        return (
          <div
            key={node.id}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => !isRenaming && onOpen(node)}
            onContextMenu={(e) => onContextMenu(e, node)}
            className={`flex w-full items-center gap-3 border-b border-border/50 px-3.5 py-2.5 text-left last:border-b-0 transition-colors duration-100
              ${selected === node.id ? "bg-accent/[0.08]" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}>
              <Icon size={13} strokeWidth={1.9} />
            </span>
            {isRenaming ? (
              <InlineNameInput
                value={renamingValue}
                onChange={onRenamingChange}
                onCommit={() => onCommitRename(node)}
                onCancel={onCancelRename}
                className="flex-1 rounded border border-accent/50 bg-background px-1.5 py-0.5 text-[13px] text-foreground outline-none"
              />
            ) : (
              <span className="flex-1 truncate text-[13px] text-foreground">{node.name}</span>
            )}
            <span className="w-20 shrink-0 text-right text-[10.5px] text-foreground-secondary/55">
              {node.type === "folder" ? "Folder" : node.imported ? (node.name.split(".").pop()?.toUpperCase() ?? "File") : "Note"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getFileVisualSafe(node) {
  if (!node.imported) return { icon: FileText, color: "#f5b942" };
  const ext = node.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { icon: FileText, color: "#ef4444" };
  if (["xls", "xlsx", "csv"].includes(ext)) return { icon: FileSpreadsheet, color: "#22c55e" };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { icon: FileImage, color: "#38bdf8" };
  return { icon: FileText, color: "#94a3b8" };
}

function EmptyState({ searching }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.035] text-foreground-secondary/45 dark:bg-white/[0.045]">
        {searching ? <Search size={22} /> : <FolderOpen size={22} />}
      </span>
      <div>
        <p className="text-xs font-medium text-foreground-secondary">{searching ? "No matches found" : "This folder is empty"}</p>
        {!searching && <p className="mt-0.5 text-[11px] text-foreground-secondary/55">Use the header actions above to create or import something</p>}
      </div>
    </div>
  );
}
