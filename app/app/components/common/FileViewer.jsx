"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, AlertCircle } from "lucide-react";
import { useFileSystemStore } from "@/app/stores";
import { fetchFileDataUrl } from "@/app/lib/axios";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">Loading PDF viewer...</div>,
});
const HtmlViewer = dynamic(() => import("./HtmlViewer"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">Loading HTML viewer...</div>,
});

// No filename header here either — window titlebar already shows it.
export default function FileViewer({ fileId }) {
  const node = useFileSystemStore((s) => s.items[fileId]);

  const [dataUrl, setDataUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isImage = node?.imported && node?.mimeType?.startsWith("image/");
  const isPdf = node?.imported && node?.mimeType === "application/pdf";
  const isHtml =
    node?.imported &&
    (
      node?.mimeType === "text/html" ||
      node?.name?.toLowerCase().endsWith(".html")
    );
  useEffect(() => {
    if (!node?.imported || !(isImage || isPdf)) return;
    let cancelled = false;

    // These two setState calls run synchronously at the top of the effect,
    // which the newer react-hooks/set-state-in-effect rule flags on the
    // assumption it causes a cascading extra render. That's the standard,
    // safe "reset loading/error before a fetch" pattern though — it's not
    // syncing derived state from props (the actual footgun the rule is
    // designed to catch), so it's intentionally kept as-is here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    fetchFileDataUrl(node.id)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this file from the server.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  if (!node) {
    return <div className="p-4 text-xs text-foreground-secondary">File not found.</div>;
  }

  if ((isImage || isPdf) && isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-foreground-secondary">
        <Loader2 size={14} className="animate-spin" />
        Loading file...
      </div>
    );
  }

  if ((isImage || isPdf) && error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-foreground-secondary">
        <AlertCircle size={18} className="text-red-500" />
        {error}
      </div>
    );
  }

  if (isHtml) {
  return (
    <HtmlViewer
      fileId={node.id}
      fileName={node.name}
    />
  );
}
  if (isPdf) {
    return (
      <PdfViewer
        dataUrl={dataUrl}
        fileName={node.name}
        // The backend doesn't yet support replacing an uploaded file's
        // bytes (only text-note content can be saved back via
        // updateFileContent) — so edits here update what's shown in this
        // session only and won't survive a reload. Add a
        // PUT /nodes/:id/replace endpoint + a matching store action if
        // you want annotated PDFs to actually persist.
        onSave={(newDataUrl) => setDataUrl(newDataUrl)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex-1 overflow-auto p-4">
        {isImage ? (
          <img src={dataUrl} alt={node.name} className="mx-auto max-w-full rounded-md" />
        ) : node.imported ? (
          <div className="flex h-full items-center justify-center text-center text-xs text-foreground-secondary">
            No inline preview for this file type ({node.mimeType || "unknown"}).
            <br />
            {((node.size || 0) / 1024).toFixed(1)} KB
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-xs text-foreground-secondary">{node.content || "(empty file)"}</p>
        )}
      </div>
    </div>
  );
}
