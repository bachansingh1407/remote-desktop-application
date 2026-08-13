"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Folder, FolderOpen, FileText, FolderPlus, FilePlus2, ChevronRight,
  Trash2, LayoutGrid, ListIcon, Home, Upload, FileSpreadsheet, FileImage,
  Pencil, Copy, FolderInput, Search, X,
  FileCode2, FileJson2, FileAudio2, FileVideo2, FileArchive, FileTerminal,
  ArrowUpDown, ChevronDown, Check, ArrowUp, ArrowDown, UploadCloud,
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

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Kind" },
  { key: "size", label: "Size" },
  { key: "modified", label: "Date modified" },
];

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

  const openWindow = useWindowStore((s) => s.openWindow);
  const { openMenu } = useContextMenu();

  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("grid");
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [fileDragActive, setFileDragActive] = useState(false);
  const fileDragCounter = useRef(0);
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
  const totalSize = children.reduce((sum, n) => sum + (n.type === "file" ? (n.size || 0) : 0), 0);
  const currentFolderLabel = path.length ? path[path.length - 1].name : "Campus";

  // Folders always float to the top, then the chosen field breaks ties
  // within each group; name is always the final tiebreaker so ordering
  // never looks arbitrary.
  const sortedChildren = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...children].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      let cmp = 0;
      if (sortBy === "size") cmp = (a.size || 0) - (b.size || 0);
      else if (sortBy === "modified") cmp = new Date(a.updatedAt || 0) - new Date(b.updatedAt || 0);
      else if (sortBy === "kind") cmp = getKindLabel(a).localeCompare(getKindLabel(b));
      if (cmp === 0) cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      return cmp * dir;
    });
  }, [children, sortBy, sortDir]);

  const handleColumnSort = (key) => {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir("asc"); }
  };

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

  const importFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    for (const file of files) {
      try {
        await importFile(currentFolderId, file);
      } catch (err) {
        toast.error(`Couldn't import "${file.name}"`, err.response?.data?.message || err.message);
      }
    }
  };

  const handleFilesSelected = async (e) => {
    await importFiles(e.target.files);
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

  // OS-level file drag (dragging from the desktop / file explorer straight
  // into the window). Distinguished from internal item-reordering drags by
  // the presence of a native "Files" type on the DataTransfer — internal
  // drags never set that, so the two never collide.
  const isOsFileDrag = (e) => e.dataTransfer?.types?.includes("Files");

  const handleWindowDragEnter = (e) => {
    if (!isOsFileDrag(e) || isSearching) return;
    e.preventDefault();
    fileDragCounter.current += 1;
    setFileDragActive(true);
  };
  const handleWindowDragOver = (e) => {
    if (!isOsFileDrag(e) || isSearching) return;
    e.preventDefault();
  };
  const handleWindowDragLeave = (e) => {
    if (!isOsFileDrag(e) || isSearching) return;
    fileDragCounter.current = Math.max(0, fileDragCounter.current - 1);
    if (fileDragCounter.current === 0) setFileDragActive(false);
  };
  const handleWindowDrop = async (e) => {
    if (!isOsFileDrag(e) || isSearching) return;
    e.preventDefault();
    fileDragCounter.current = 0;
    setFileDragActive(false);
    await importFiles(e.dataTransfer.files);
  };

  return (
    <div
      className="relative flex h-full flex-col bg-background text-foreground"
      onDragEnter={handleWindowDragEnter}
      onDragOver={handleWindowDragOver}
      onDragLeave={handleWindowDragLeave}
      onDrop={handleWindowDrop}
    >
      {/* toolbar — quiet, structured, two clear rows: location+search, then actions */}
      <div className="sticky top-0 z-10 flex shrink-0 flex-col gap-2.5 border-b border-border bg-background-elevated px-4 pt-3 pb-2.5 backdrop-blur-xl">
        {/* row 1 — path + search */}
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1 text-[12.5px]">
            <button
              onClick={() => setCurrentFolderId(null)}
              onDragOver={(e) => handleDragOver(e, "home")}
              onDrop={(e) => handleDrop(e, null)}
              className={`-mx-1.5 shrink-0 rounded-md px-1.5 py-1 font-medium transition-colors duration-150
                ${dragOverId === "home" ? "bg-accent/10 text-accent" : path.length === 0 ? "text-foreground" : "text-foreground-secondary hover:text-foreground"}`}
            >
              Campus
            </button>
            {path.map((node, i) => (
              <span key={node.id} className="flex min-w-0 items-center gap-1">
                <ChevronRight size={11} className="shrink-0 text-foreground-secondary/30" />
                <button
                  onClick={() => setCurrentFolderId(node.id)}
                  onDragOver={(e) => handleDragOver(e, node.id)}
                  onDrop={(e) => handleDrop(e, node)}
                  className={`-mx-1.5 truncate rounded-md px-1.5 py-1 transition-colors duration-150
                    ${dragOverId === node.id ? "bg-accent/10 text-accent" : "text-foreground-secondary hover:text-foreground"}
                    ${i === path.length - 1 ? "font-semibold text-foreground" : ""}`}
                >
                  {node.name}
                </button>
              </span>
            ))}
          </div>

          {/* search — fixed width, calm, no motion tricks */}
          <div className="flex w-56 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-[7px] transition-colors duration-150 focus-within:border-accent/45 focus-within:ring-[3px] focus-within:ring-accent/10">
            <Search size={13} className="shrink-0 text-foreground-secondary/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-full min-w-0 bg-transparent text-[12.5px] text-foreground outline-none placeholder-foreground-secondary/50"
            />
            {query && (
              <button onClick={() => setQuery("")} className="shrink-0 text-foreground-secondary/50 transition-colors hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* row 2 — actions / sort / view */}
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5">
            <ToolbarButton icon={FolderPlus} label="New folder" onClick={() => startCreate("folder")} disabled={isSearching} />
            <ToolbarButton icon={FilePlus2} label="New file" onClick={() => startCreate("file")} disabled={isSearching} />
          </div>
          <ToolbarButton icon={Upload} label="Import" onClick={handleImportClick} disabled={isSearching} variant="solid" />
          <input ref={fileInputRef} type="file" multiple onChange={handleFilesSelected} className="hidden" />

          <div className="flex-1" />

          <SortMenu
            sortBy={sortBy}
            sortDir={sortDir}
            onSelect={(key) => { setSortBy(key); setSortDir("asc"); }}
            onToggleDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          />

          <div className="h-5 w-px shrink-0 bg-border" />

          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border p-0.5">
            <button onClick={() => setView("grid")} title="Grid view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150
                ${view === "grid" ? "bg-foreground/[0.08] text-foreground" : "text-foreground-secondary/55 hover:text-foreground"}`}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => setView("list")} title="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150
                ${view === "list" ? "bg-foreground/[0.08] text-foreground" : "text-foreground-secondary/55 hover:text-foreground"}`}>
              <ListIcon size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* contents */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {children.length === 0 && !creating ? (
          <EmptyState searching={isSearching} />
        ) : view === "grid" ? (
          <GridView
            items={sortedChildren} selected={selected} onSelect={setSelected} onOpen={openNode}
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
            items={sortedChildren} selected={selected} onSelect={setSelected} onOpen={openNode} onContextMenu={handleNodeContextMenu}
            creating={creating} creatingName={creatingName} onCreatingNameChange={setCreatingName}
            onCommitCreate={commitCreate} onCancelCreate={cancelCreate}
            renamingId={renamingId} renamingValue={renamingValue} onRenamingChange={setRenamingValue}
            onCommitRename={commitRename} onCancelRename={() => setRenamingId(null)}
            sortBy={sortBy} sortDir={sortDir} onSort={handleColumnSort}
          />
        )}
      </div>

      {/* footer — status bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-background-secondary/40 px-4 py-2 text-[11px] text-foreground-secondary/70">
        <span className="flex items-center gap-3">
          <span>{folderCount} folder{folderCount !== 1 ? "s" : ""}</span>
          <span className="text-foreground-secondary/25">·</span>
          <span>{fileCount} file{fileCount !== 1 ? "s" : ""}</span>
          {totalSize > 0 && (
            <>
              <span className="text-foreground-secondary/25">·</span>
              <span className="tabular-nums">{formatBytes(totalSize)}</span>
            </>
          )}
        </span>
        {isSearching && <span className="font-medium text-accent">{children.length} result{children.length !== 1 ? "s" : ""} for &quot;{query}&quot;</span>}
      </div>

      {/* OS-level drag-and-drop import overlay */}
      {fileDragActive && (
        <div className="animate-fade-in pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/75 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-accent/40 bg-background-elevated px-10 py-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
              <UploadCloud size={20} strokeWidth={1.75} />
            </span>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-foreground">Drop to import</p>
              <p className="mt-0.5 text-[11.5px] text-foreground-secondary">Adds to {currentFolderLabel}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick, disabled, variant = "ghost" }) {
  const base = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35";
  const styles = variant === "solid"
    ? "bg-accent text-white hover:bg-accent/90 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
    : "text-foreground-secondary hover:bg-foreground/[0.05] hover:text-foreground";
  return (
    <button onClick={onClick} disabled={disabled} title={label} className={`${base} ${styles}`}>
      <Icon size={14} strokeWidth={2} />
      <span>{label}</span>
    </button>
  );
}

// "Sort by" menu — self-contained, closes on outside click / Escape.
function SortMenu({ sortBy, sortDir, onSelect, onToggleDir, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.key === sortBy) ?? SORT_OPTIONS[0];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-foreground-secondary transition-colors duration-150 hover:bg-foreground/[0.05] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
      >
        <ArrowUpDown size={12.5} strokeWidth={2} />
        <span>{current.label}</span>
        <ChevronDown size={12} className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-fade-in absolute right-0 top-[calc(100%+6px)] z-20 w-44 overflow-hidden rounded-lg border border-border bg-background-elevated py-1 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-foreground-secondary/45">Sort by</div>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => { onSelect(o.key); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors duration-100 hover:bg-foreground/[0.05]
                ${sortBy === o.key ? "text-accent font-medium" : "text-foreground"}`}
            >
              {o.label}
              {sortBy === o.key && <Check size={13} />}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => { onToggleDir(); setOpen(false); }}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] text-foreground-secondary transition-colors duration-100 hover:bg-foreground/[0.05] hover:text-foreground"
          >
            {sortDir === "asc" ? "Ascending" : "Descending"}
            {sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
          </button>
        </div>
      )}
    </div>
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

// Icon "tile" behind every file/folder glyph. This used to be a faint
// same-color wash over the panel background (a low-contrast, ~15%-opacity
// tint) — it read as washed-out rather than designed. Now it's a solid,
// saturated fill with a subtle top-to-bottom gradient for depth and a
// matching soft drop shadow, with the glyph rendered in white on top for
// real contrast. No translucency in the fill itself; the only transparency
// left is the shadow, which is how real depth is supposed to work.
function chipStyle(color) {
  return {
    backgroundImage: `linear-gradient(160deg,
      color-mix(in srgb, ${color} 88%, white) 0%,
      ${color} 45%,
      color-mix(in srgb, ${color} 82%, black) 100%)`,
    color: "#ffffff",
    boxShadow: `0 2px 6px -1px color-mix(in srgb, ${color} 55%, transparent),
      inset 0 1px 0 color-mix(in srgb, white 30%, transparent)`,
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
      className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-x-1 gap-y-4 content-start min-h-full"
    >
      {creating && (
        <div className="animate-fade-in flex flex-col items-center gap-2.5 rounded-xl p-3 text-center ring-1 ring-inset ring-accent/35 bg-accent/[0.06]">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px]"
            style={chipStyle(creating.type === "folder" ? CATEGORY_COLORS.folder : CATEGORY_COLORS.note)}>
            {creating.type === "folder" ? <Folder size={19} strokeWidth={1.9} /> : <FileText size={19} strokeWidth={1.9} />}
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
        const { icon: Icon, color } = getFileVisualSafe(node);
        const isDragging = draggedId === node.id;
        const isDropTarget = node.type === "folder" && dragOverId === node.id;
        const isRenaming = renamingId === node.id;
        const isSelected = selected === node.id;
        const folderPath = isSearching ? getPath(node.id).slice(0, -1) : null;
        const DisplayIcon = node.type === "folder" ? (isDropTarget ? FolderOpen : Folder) : Icon;

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
            className={`group relative flex flex-col items-center gap-2 rounded-sm px-2 py-3 text-center transition-colors duration-150
              ${isDragging ? "opacity-40" : ""}
              ${isDropTarget ? "bg-accent/10 ring-1 ring-inset ring-accent/40"
                : isSelected ? "bg-accent/[0.07] ring-1 ring-inset ring-accent/30"
                : "hover:bg-foreground/[0.035]"}`}
          >
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[6px] transition-transform duration-150 group-hover:scale-[1.04]"
              style={isImageNode(node) ? undefined : chipStyle(color)}>
              {isImageNode(node) ? (
                <ImageThumb node={node} fallback={<span className="flex h-full w-full items-center justify-center rounded-[12px]" style={chipStyle(color)}><Icon size={19} strokeWidth={1.9} /></span>} />
              ) : (
                <DisplayIcon size={19} strokeWidth={1.9} />
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
              <span className={`line-clamp-2 w-full break-words text-[11.5px] leading-tight text-foreground ${isSelected ? "font-semibold" : "font-medium"}`}>{node.name}</span>
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
  sortBy, sortDir, onSort,
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="sticky top-0 z-[1] flex items-center gap-3 border-b border-border bg-background-elevated/95 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-foreground-secondary/50 backdrop-blur-xl">
        <ColumnHeader label="Name" field="name" active={sortBy} dir={sortDir} onSort={onSort} className="flex-1 text-left" />
        <ColumnHeader label="Size" field="size" active={sortBy} dir={sortDir} onSort={onSort} className="hidden w-24 text-right sm:flex" />
        <ColumnHeader label="Modified" field="modified" active={sortBy} dir={sortDir} onSort={onSort} className="hidden w-28 text-right md:flex" />
        <ColumnHeader label="Kind" field="kind" active={sortBy} dir={sortDir} onSort={onSort} className="w-16 text-right" />
      </div>

      {creating && (
        <div className="animate-fade-in flex w-full items-center gap-3 border-b border-border/60 bg-accent/[0.06] px-4 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
            style={chipStyle(creating.type === "folder" ? CATEGORY_COLORS.folder : CATEGORY_COLORS.note)}>
            {creating.type === "folder" ? <Folder size={13} strokeWidth={2} /> : <FileText size={13} strokeWidth={2} />}
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
        const { icon: Icon, color } = getFileVisualSafe(node);
        const isRenaming = renamingId === node.id;
        const isSelected = selected === node.id;
        const kindLabel = getKindLabel(node);
        return (
          <div
            key={node.id}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => !isRenaming && onOpen(node)}
            onContextMenu={(e) => onContextMenu(e, node)}
            className={`group relative flex w-full items-center gap-3 border-b border-border/50 py-2 pl-4 pr-4 text-left transition-colors duration-100 last:border-b-0
              ${isSelected ? "bg-accent/[0.08]" : "hover:bg-foreground/[0.03]"}`}
          >
            {/* left accent bar — reads as "selected" without flattening the row into a solid tint */}
            <span
              className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-accent transition-opacity duration-150
                ${isSelected ? "opacity-100" : "opacity-0"}`}
            />

            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px]"
              style={isImageNode(node) ? undefined : chipStyle(color)}>
              {isImageNode(node) ? (
                <ImageThumb node={node} fallback={<span className="flex h-full w-full items-center justify-center rounded-[6px]" style={chipStyle(color)}><Icon size={13} strokeWidth={2} /></span>} />
              ) : (
                <Icon size={13} strokeWidth={2} />
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
              <span className={`flex-1 truncate text-[13px] leading-none text-foreground ${isSelected ? "font-medium" : ""}`}>{node.name}</span>
            )}

            <span className="hidden w-24 shrink-0 text-right text-[11.5px] tabular-nums text-foreground-secondary/70 sm:block">
              {node.type === "folder" ? "—" : formatBytes(node.size)}
            </span>
            <span className="hidden w-28 shrink-0 text-right text-[11.5px] tabular-nums text-foreground-secondary/70 md:block">
              {formatModified(node.updatedAt)}
            </span>
            <span className="w-16 shrink-0 text-right">
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                  color: `color-mix(in srgb, ${color} 70%, black)`,
                }}
              >
                {kindLabel}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ColumnHeader({ label, field, active, dir, onSort, className }) {
  const isActive = active === field;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 transition-colors duration-100 hover:text-foreground ${isActive ? "text-accent" : ""} ${className}`}
    >
      {label}
      {isActive && (dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
    </button>
  );
}

// A handful of muted, semantic categories rather than one color per file
// extension — color communicates *kind of thing* (document, code, media...)
// while the icon shape communicates the exact type. Folder blue is kept
// a touch more saturated than the file categories so it reads as the
// "container" color at a glance, same as most desktop file managers.
const CATEGORY_COLORS = {
  folder: "#4f8ef7",
  note: "#c8880c",
  document: "#3b6fd6",
  data: "#1f9d55",
  image: "#0891b2",
  media: "#c2417a",
  archive: "#b45309",
  code: "#0d9488",
  unknown: "#71767f",
};

const FILE_TYPE_MAP = [
  { exts: ["pdf", "doc", "docx", "rtf", "odt", "ppt", "pptx", "key", "md", "markdown", "txt", "log"], category: "document", icon: FileText },
  { exts: ["xls", "xlsx", "csv"], category: "data", icon: FileSpreadsheet },
  { exts: ["json", "yml", "yaml", "toml"], category: "data", icon: FileJson2 },
  { exts: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"], category: "image", icon: FileImage },
  { exts: ["mp3", "wav", "ogg", "flac", "m4a", "aac"], category: "media", icon: FileAudio2 },
  { exts: ["mp4", "mov", "webm", "mkv", "avi"], category: "media", icon: FileVideo2 },
  { exts: ["zip", "rar", "7z", "tar", "gz", "tgz"], category: "archive", icon: FileArchive },
  { exts: ["html", "htm", "css", "scss", "sass", "less"], category: "code", icon: FileCode2 },
  { exts: ["jsx", "tsx", "js", "mjs", "cjs", "ts", "py", "java", "kt", "c", "cpp", "h", "hpp", "cs", "go", "rb", "php"], category: "code", icon: FileCode2 },
  { exts: ["sh", "bash", "zsh"], category: "code", icon: FileTerminal },
];

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];

function isImageNode(node) {
  if (!node.imported || node.type !== "file") return false;
  const ext = node.name.split(".").pop()?.toLowerCase();
  return IMAGE_EXTS.includes(ext);
}

function getKindLabel(node) {
  if (node.type === "folder") return "Folder";
  if (!node.imported) return "Note";
  return node.name.split(".").pop()?.toUpperCase() ?? "File";
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
  if (node.type === "folder") return { icon: Folder, color: CATEGORY_COLORS.folder };

  // In-app notes (not imported) — keep their existing warm "note" look.
  if (!node.imported) return { icon: FileText, color: CATEGORY_COLORS.note };

  const ext = node.name.split(".").pop()?.toLowerCase();
  const match = FILE_TYPE_MAP.find((group) => group.exts.includes(ext));
  if (match) return { icon: match.icon, color: CATEGORY_COLORS[match.category] };

  // Truly unknown extension — neutral fallback, distinct from every
  // recognized category above so it doesn't get confused with "note".
  return { icon: FileText, color: CATEGORY_COLORS.unknown };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

function formatModified(ts) {
  if (!ts) return "—";
  const date = new Date(ts);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

function EmptyState({ searching }) {
  return (
    <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-3.5 rounded-xl border border-dashed border-border text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04] text-foreground-secondary/45">
        {searching ? <Search size={22} strokeWidth={1.6} /> : <FolderOpen size={22} strokeWidth={1.6} />}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-foreground-secondary">{searching ? "No matches found" : "This folder is empty"}</p>
        {!searching && <p className="mt-1 text-[11.5px] text-foreground-secondary/55">Drag files in, or use the toolbar above to create or import something</p>}
      </div>
    </div>
  );
}