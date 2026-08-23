"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, X, ChevronLeft, ChevronRight, ImageOff, FolderOpen, CheckSquare, Square } from "lucide-react";
import { useFileSystemStore } from "@/app/stores";
import { toast } from "@/app/stores/useToastStore";
import { fetchFileDataUrl, downloadNode, downloadNodes } from "@/app/lib/axios";

// A real new feature (not one of the disabled dev-only apps): a single
// place to browse every image across the whole workspace — regardless of
// which folder it's tucked into — as a grid, with a lightbox and the new
// bulk-zip download wired straight into it. Every image tile fetches its
// thumbnail lazily and only once (see `useImageUrl` below), so opening
// Gallery on a workspace with a lot of photos doesn't fire 50 requests at
// once.
function isImageNode(n) {
  return n && n.type === "file" && n.imported && n.mimeType?.startsWith("image/");
}

function useImageUrl(nodeId) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Standard "reset loading/error before a fetch" pattern — see the
    // identical comment/justification in FileViewer.jsx, which this
    // mirrors.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setFailed(false);
    fetchFileDataUrl(nodeId)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  return { url, failed };
}

function GalleryTile({ node, selected, selectMode, onOpen, onToggleSelect }) {
  const { url, failed } = useImageUrl(node.id);

  return (
    <button
      onClick={() => (selectMode ? onToggleSelect(node.id) : onOpen(node))}
      className={`group relative aspect-square overflow-hidden rounded-lg border bg-background-secondary transition-all
        ${selected ? "border-accent ring-2 ring-accent/40" : "border-border hover:border-accent/40"}`}
      title={node.name}
    >
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground-secondary/50">
          <ImageOff size={18} />
        </div>
      ) : url ? (
        <img src={url} alt={node.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full animate-pulse bg-foreground/[0.06]" />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[10.5px] font-medium text-white">{node.name}</p>
      </div>

      {selectMode && (
        <div className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-0.5 text-white">
          {selected ? <CheckSquare size={14} /> : <Square size={14} />}
        </div>
      )}
    </button>
  );
}

function Lightbox({ images, index, onClose, onNav }) {
  const node = images[index];
  const { url, failed } = useImageUrl(node.id);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNav(-1);
      if (e.key === "ArrowRight") onNav(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNav]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <p className="truncate text-[12.5px] text-white/85">{node.name}</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => downloadNode(node.id, node.name).catch(() => toast.error("Download failed"))}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[11.5px] text-white hover:bg-white/20"
          >
            <Download size={13} /> Download
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
        {images.length > 1 && (
          <button
            onClick={() => onNav(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {failed ? (
          <div className="flex flex-col items-center gap-2 text-white/50">
            <ImageOff size={28} />
            <p className="text-xs">Couldn&apos;t load this image</p>
          </div>
        ) : url ? (
          <img src={url} alt={node.name} className="max-h-full max-w-full rounded-md object-contain" />
        ) : (
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        )}
        {images.length > 1 && (
          <button
            onClick={() => onNav(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function GalleryApp() {
  const items = useFileSystemStore((s) => s.items);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(false);

  const images = useMemo(
    () =>
      Object.values(items)
        .filter((n) => isImageNode(n) && !n.trashed)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [items]
  );

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleOpen = (node) => setLightboxIndex(images.findIndex((n) => n.id === node.id));
  const handleNav = (delta) =>
    setLightboxIndex((i) => (i === null ? null : (i + delta + images.length) % images.length));

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      await downloadNodes([...selected], `photos-${selected.size}.zip`);
      toast.success(`Downloading ${selected.size} photo${selected.size === 1 ? "" : "s"}`);
      setSelected(new Set());
      setSelectMode(false);
    } catch {
      toast.error("Couldn't download those photos");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (images.length === 0) return;
    setDownloading(true);
    try {
      await downloadNodes(images.map((n) => n.id), `all-photos-${images.length}.zip`);
      toast.success(`Downloading all ${images.length} photos`);
    } catch {
      toast.error("Couldn't download your photos");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-[12px] text-foreground-secondary">
          {images.length} photo{images.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-1.5">
          {selectMode && selected.size > 0 && (
            <button
              onClick={handleDownloadSelected}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11.5px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Download size={13} /> Download {selected.size}
            </button>
          )}
          {images.length > 0 && (
            <button
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected(new Set());
              }}
              className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                selectMode
                  ? "bg-foreground/10 text-foreground"
                  : "text-foreground-secondary hover:bg-foreground/[0.06]"
              }`}
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
          )}
          {!selectMode && images.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-md bg-foreground/[0.06] px-2.5 py-1.5 text-[11.5px] font-medium text-foreground hover:bg-foreground/10 disabled:opacity-50"
            >
              <Download size={13} /> Download all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {images.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-foreground-secondary">
            <FolderOpen size={26} className="opacity-40" />
            <p className="text-[12.5px]">No photos yet</p>
            <p className="text-[11px] opacity-70">Images you import anywhere in Files show up here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {images.map((node) => (
              <GalleryTile
                key={node.id}
                node={node}
                selected={selected.has(node.id)}
                selectMode={selectMode}
                onOpen={handleOpen}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox images={images} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onNav={handleNav} />
      )}
    </div>
  );
}
