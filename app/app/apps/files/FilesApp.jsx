"use client";

import { useState, useRef, useEffect } from "react";
import {
  Folder, FileText, FolderPlus, FilePlus2, ChevronRight,
  Trash2, LayoutGrid, ListIcon, Home, Upload, FileSpreadsheet, FileImage,
  Pencil, Copy, FolderInput, Search, X, FolderOpen,
  FileCode2, FileJson2, FileAudio2, FileVideo2, FileArchive, FileTerminal,
} from "lucide-react";
import { useFileSystemStore, useWindowStore } from "@/app/stores";
import { toast } from "@/app/stores/useToastStore";
import { useContextMenu } from "@/app/components/common/ContextMenu";
import FileEditor from "@/app/components/common/FileEditor";
import { fetchFileDataUrl } from "@/app/lib/axios";
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
      {/* header — glassy, matches Window/Taskbar chrome language */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-border bg-background-elevated px-4 py-3 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        {/* breadcrumb */}
        <div className="flex min-w-0 flex-1 items-center gap-0.5 text-xs text-foreground-secondary">
          <button
            onClick={() => setCurrentFolderId(null)}
            onDragOver={(e) => handleDragOver(e, "home")}
            onDrop={(e) => handleDrop(e, null)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all duration-150
              ${dragOverId === "home" ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30" : "hover:bg-foreground/[0.055] hover:text-foreground"}`}
          >
            <Home size={13} strokeWidth={2} />
            Workspace
          </button>
          {path.map((node, i) => (
            <span key={node.id} className="flex min-w-0 items-center gap-0.5">
              <ChevronRight size={12} className="shrink-0 text-foreground-secondary/30" />
              <button
                onClick={() => setCurrentFolderId(node.id)}
                onDragOver={(e) => handleDragOver(e, node.id)}
                onDrop={(e) => handleDrop(e, node)}
                className={`truncate rounded-lg px-2.5 py-1.5 transition-all duration-150
                  ${dragOverId === node.id ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30" : "hover:bg-foreground/[0.055] hover:text-foreground"}
                  ${i === path.length - 1 ? "font-semibold text-foreground" : ""}`}
              >
                {node.name}
              </button>
            </span>
          ))}
        </div>

        {/* search — pill, widens and glows on focus */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 transition-all duration-200 ease-out focus-within:w-56 focus-within:border-accent/40 focus-within:bg-background focus-within:ring-4 focus-within:ring-accent/[0.12] w-40">
          <Search size={13} className="shrink-0 text-foreground-secondary/55" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspace..."
            className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none placeholder-foreground-secondary/55"
          />
          {query && (
            <button onClick={() => setQuery("")} className="shrink-0 rounded-full p-0.5 text-foreground-secondary/55 hover:bg-foreground/10 hover:text-foreground">
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
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-foreground/[0.02] p-0.5">
          <button onClick={() => setView("grid")} title="Grid view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150
              ${view === "grid" ? "bg-accent text-white shadow-sm" : "text-foreground-secondary/60 hover:bg-foreground/[0.06] hover:text-foreground"}`}>
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => setView("list")} title="List view"
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-all duration-150
              ${view === "list" ? "bg-accent text-white shadow-sm" : "text-foreground-secondary/60 hover:bg-foreground/[0.06] hover:text-foreground"}`}>
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
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-background-secondary/40 px-4 py-2.5 text-[11px] text-foreground-secondary/70">
        <span className="flex items-center gap-3.5">
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-foreground/[0.06]"><Folder size={10} className="text-foreground-secondary/60" /></span>
            {folderCount}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-foreground/[0.06]"><FileText size={10} className="text-foreground-secondary/60" /></span>
            {fileCount}
          </span>
        </span>
        {isSearching && <span className="font-medium text-accent">{children.length} result{children.length !== 1 ? "s" : ""} for &quot;{query}&quot;</span>}
      </div>
    </div>
  );
}

function HeaderIconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-foreground-secondary
                 transition-all duration-150 hover:bg-foreground/[0.06] hover:text-foreground active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100">
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

// Soft colored "glow" behind an icon tile — the signature touch that makes
// file/folder icons read as tactile chips instead of flat colored squares.
function iconTileStyle(color) {
  return {
    background: `linear-gradient(155deg, ${color}, color-mix(in srgb, ${color} 78%, black))`,
    boxShadow: `0 3px 10px -3px ${color}80, inset 0 1px 0 rgba(255,255,255,0.25)`,
  };
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
      className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-x-2 gap-y-4 content-start min-h-full"
    >
      {creating && (
        <div className="animate-scale-in flex flex-col items-center gap-2.5 rounded-2xl p-3 text-center ring-1 ring-inset ring-accent/40 bg-accent/[0.07]">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-[14px] text-white"
            style={iconTileStyle(creating.type === "folder" ? "#22d3ee" : "#f5b942")}
          >
            {creating.type === "folder" ? <Folder size={20} strokeWidth={1.8} /> : <FileText size={20} strokeWidth={1.8} />}
          </span>
          <InlineNameInput
            value={creatingName}
            onChange={onCreatingNameChange}
            onCommit={onCommitCreate}
            onCancel={onCancelCreate}
            className="w-full rounded-md border border-accent/50 bg-background px-1.5 py-1 text-center text-[11.5px] font-medium text-foreground outline-none ring-2 ring-accent/15"
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
            className={`group relative flex flex-col items-center gap-2.5 rounded-2xl p-3 text-center transition-all duration-150 ease-out
              ${isDragging ? "opacity-40" : ""}
              ${isDropTarget ? "bg-accent/15 ring-2 ring-inset ring-accent/50 scale-[1.05]"
                : selected === node.id ? "bg-accent/[0.09] ring-1 ring-inset ring-accent/35 shadow-sm"
                : "hover:-translate-y-0.5 hover:bg-foreground/[0.04] hover:shadow-md"}`}
          >
            <span
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[4px] text-white transition-transform duration-150 ease-out group-hover:scale-105"
              style={iconTileStyle(color)}
            >
              {isImageNode(node) ? (
                <ImageThumb node={node} fallback={<Icon size={20} strokeWidth={1.8} />} />
              ) : (
                <Icon size={20} strokeWidth={1.8} />
              )}
            </span>
            {isRenaming ? (
              <InlineNameInput
                value={renamingValue}
                onChange={onRenamingChange}
                onCommit={() => onCommitRename(node)}
                onCancel={onCancelRename}
                className="w-full rounded-md border border-accent/50 bg-background px-1.5 py-1 text-center text-[11.5px] font-medium text-foreground outline-none ring-2 ring-accent/15"
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
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-foreground/[0.025] px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-foreground-secondary/60">
        <span className="flex-1">Name</span>
        <span className="w-20 text-right">Type</span>
      </div>

      {creating && (
        <div className="animate-fade-in flex w-full items-center gap-3 border-b border-border/50 bg-accent/[0.07] px-4 py-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-white"
            style={iconTileStyle(creating.type === "folder" ? "#22d3ee" : "#f5b942")}
          >
            {creating.type === "folder" ? <Folder size={14} strokeWidth={1.9} /> : <FileText size={14} strokeWidth={1.9} />}
          </span>
          <InlineNameInput
            value={creatingName}
            onChange={onCreatingNameChange}
            onCommit={onCommitCreate}
            onCancel={onCancelCreate}
            className="flex-1 rounded-md border border-accent/50 bg-background px-2 py-1 text-[13px] text-foreground outline-none ring-2 ring-accent/15"
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
            className={`flex w-full items-center gap-3 border-b border-border/50 px-4 py-2.5 text-left last:border-b-0 transition-colors duration-100
              ${selected === node.id ? "bg-accent/[0.09]" : "hover:bg-foreground/[0.035]"}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-white" style={iconTileStyle(color)}>
              {isImageNode(node) ? (
                <ImageThumb node={node} fallback={<Icon size={14} strokeWidth={1.9} />} />
              ) : (
                <Icon size={14} strokeWidth={1.9} />
              )}
            </span>
            {isRenaming ? (
              <InlineNameInput
                value={renamingValue}
                onChange={onRenamingChange}
                onCommit={() => onCommitRename(node)}
                onCancel={onCancelRename}
                className="flex-1 rounded-md border border-accent/50 bg-background px-2 py-1 text-[13px] text-foreground outline-none ring-2 ring-accent/15"
              />
            ) : (
              <span className="flex-1 truncate text-[13px] text-foreground">{node.name}</span>
            )}
            <span className="w-20 shrink-0 text-right">
              <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-foreground-secondary/70">
                {node.type === "folder" ? "Folder" : node.imported ? (node.name.split(".").pop()?.toUpperCase() ?? "File") : "Note"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Per-extension icon + color, grouped by family so related file types read
// as a coherent set instead of every "other" file collapsing into one grey
// FileText tile.
const FILE_VISUALS = [
  // documents / data
  { exts: ["pdf"], icon: FileText, color: "#ef4444" },
  { exts: ["xls", "xlsx", "csv"], icon: FileSpreadsheet, color: "#22c55e" },
  { exts: ["doc", "docx", "rtf", "odt"], icon: FileText, color: "#2563eb" },
  { exts: ["ppt", "pptx", "key"], icon: FileText, color: "#f97316" },
  { exts: ["md", "markdown"], icon: FileText, color: "#64748b" },
  { exts: ["txt", "log"], icon: FileText, color: "#94a3b8" },

  // images
  { exts: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"], icon: FileImage, color: "#38bdf8" },

  // audio / video
  { exts: ["mp3", "wav", "ogg", "flac", "m4a", "aac"], icon: FileAudio2, color: "#a855f7" },
  { exts: ["mp4", "mov", "webm", "mkv", "avi"], icon: FileVideo2, color: "#f43f5e" },

  // archives
  { exts: ["zip", "rar", "7z", "tar", "gz", "tgz"], icon: FileArchive, color: "#d97706" },

  // markup / web
  { exts: ["html", "htm"], icon: FileCode2, color: "#e34c26" },
  { exts: ["css", "scss", "sass", "less"], icon: FileCode2, color: "#ec4899" },
  { exts: ["json", "yml", "yaml", "toml"], icon: FileJson2, color: "#eab308" },

  // code
  { exts: ["jsx", "tsx"], icon: FileCode2, color: "#22d3ee" },
  { exts: ["js", "mjs", "cjs"], icon: FileCode2, color: "#f7df1e" },
  { exts: ["ts"], icon: FileCode2, color: "#3178c6" },
  { exts: ["py"], icon: FileCode2, color: "#3776ab" },
  { exts: ["java", "kt"], icon: FileCode2, color: "#ea580c" },
  { exts: ["c", "cpp", "h", "hpp", "cs"], icon: FileCode2, color: "#8b5cf6" },
  { exts: ["go"], icon: FileCode2, color: "#06b6d4" },
  { exts: ["rb"], icon: FileCode2, color: "#dc2626" },
  { exts: ["php"], icon: FileCode2, color: "#7c3aed" },
  { exts: ["sh", "bash", "zsh"], icon: FileTerminal, color: "#475569" },
];

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];

function isImageNode(node) {
  if (!node.imported || node.type !== "file") return false;
  const ext = node.name.split(".").pop()?.toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

// Module-level cache (outside the component, so it survives re-renders and
// folder navigation within the same session) — nodeId -> data URL. Keeps us
// from re-downloading the same image every time its folder is opened again.
const thumbnailCache = new Map();

// Fetches an image's bytes through the authenticated download route (same
// helper FileViewer uses) and renders it once loaded. Shows the normal
// colored icon as a placeholder while loading, and permanently on failure
// (e.g. the file was deleted server-side) so a broken thumbnail never
// shows a broken-image icon.
function ImageThumb({ node, fallback }) {
  const [dataUrl, setDataUrl] = useState(() => thumbnailCache.get(node.id) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (dataUrl || failed) return;
    let cancelled = false;
    fetchFileDataUrl(node.id)
      .then((url) => {
        if (cancelled) return;
        thumbnailCache.set(node.id, url);
        setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [node.id, dataUrl, failed]);

  if (!dataUrl || failed) return fallback;
  return <img src={dataUrl} alt="" draggable={false} className="h-full w-full object-cover" />;
}

function getFileVisualSafe(node) {
  // In-app notes (not imported) — keep their existing warm "note" look.
  if (!node.imported) return { icon: FileText, color: "#f5b942" };

  const ext = node.name.split(".").pop()?.toLowerCase();
  const match = FILE_VISUALS.find((group) => group.exts.includes(ext));
  if (match) return { icon: match.icon, color: match.color };

  // Truly unknown extension — neutral fallback, distinct from every
  // recognized type above so it doesn't get confused with "note".
  return { icon: FileText, color: "#94a3b8" };
}

function EmptyState({ searching }) {
  return (
    <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-3.5 rounded-2xl border border-dashed border-border/70 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-foreground/[0.04] text-foreground-secondary/45 ring-1 ring-inset ring-border">
        {searching ? <Search size={24} strokeWidth={1.6} /> : <FolderOpen size={24} strokeWidth={1.6} />}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-foreground-secondary">{searching ? "No matches found" : "This folder is empty"}</p>
        {!searching && <p className="mt-1 text-[11.5px] text-foreground-secondary/55">Use the header actions above to create or import something</p>}
      </div>
    </div>
  );
}