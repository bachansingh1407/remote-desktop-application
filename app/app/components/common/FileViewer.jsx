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

const CodePreview = dynamic(() => import("./CodePreview"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">Loading preview...</div>,
});

// What special-case viewer (if any) this node needs. "html"/"jsx" get the
// split code+preview view; anything else imported falls through to the
// generic "no inline preview" branch below.
function getPreviewKind(node) {
  if (!node?.imported) return null;
  if (node.mimeType?.startsWith("image/")) return "image";
  if (node.mimeType === "application/pdf") return "pdf";
  const name = (node.name || "").toLowerCase();
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".jsx")) return "jsx";
  return null;
}

// No filename header here either — window titlebar already shows it.
export default function FileViewer({ fileId }) {
  const node = useFileSystemStore((s) => s.items[fileId]);
  const kind = getPreviewKind(node);

  const [dataUrl, setDataUrl] = useState(null);
  const [codeText, setCodeText] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isCode = kind === "html" || kind === "jsx";
  const needsFetch = kind === "image" || kind === "pdf" || isCode;

  useEffect(() => {
    if (!needsFetch) return;
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
      .then(async (url) => {
        if (cancelled) return;
        if (isCode) {
          // Code files need actual text (to show + to transpile/render),
          // not just a URL — data:/blob: URLs are fetchable too.
          const res = await fetch(url);
          const text = await res.text();
          if (!cancelled) setCodeText(text);
        } else {
          setDataUrl(url);
        }
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
  }, [node?.id, kind]);

  if (!node) {
    return <div className="p-4 text-xs text-foreground-secondary">File not found.</div>;
  }

  if (needsFetch && isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-foreground-secondary">
        <Loader2 size={14} className="animate-spin" />
        Loading file...
      </div>
    );
  }

  if (needsFetch && error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-foreground-secondary">
        <AlertCircle size={18} className="text-red-500" />
        {error}
      </div>
    );
  }

  if (kind === "pdf") {
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

  if (isCode) {
    return <CodePreview code={codeText} kind={kind} fileName={node.name} />;
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex-1 overflow-auto p-4">
        {kind === "image" ? (
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