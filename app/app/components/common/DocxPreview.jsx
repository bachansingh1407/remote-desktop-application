"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Download } from "lucide-react";

const MAMMOTH_CDN_URL = "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";

// mammoth is only loaded once per session (module-level, outside the
// component) and reused across every .docx the user opens.
let mammothLoadPromise = null;
function loadMammoth() {
  if (typeof window !== "undefined" && window.mammoth) return Promise.resolve(window.mammoth);
  if (mammothLoadPromise) return mammothLoadPromise;

  mammothLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MAMMOTH_CDN_URL;
    script.async = true;
    script.onload = () => (window.mammoth ? resolve(window.mammoth) : reject(new Error("mammoth failed to initialize")));
    script.onerror = () => reject(new Error("network"));
    document.head.appendChild(script);

    // Same reasoning as CodePreview's CDN fallback — onerror doesn't
    // always fire for blocked/unreachable domains, so back it with a
    // timeout too instead of hanging on "Loading document..." forever.
    window.setTimeout(() => {
      if (!window.mammoth) reject(new Error("timeout"));
    }, 8000);
  }).catch((err) => {
    mammothLoadPromise = null; // allow retry on next open
    throw err;
  });

  return mammothLoadPromise;
}

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function wrapHtmlDoc(bodyHtml) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; }
      body {
        padding: 32px 40px;
        font-family: ui-serif, Georgia, "Times New Roman", serif;
        font-size: 14px;
        line-height: 1.6;
        color: #1a1a1a;
        max-width: 820px;
        margin: 0 auto;
      }
      img { max-width: 100%; height: auto; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      td, th { border: 1px solid #ccc; padding: 6px 8px; }
      h1, h2, h3 { line-height: 1.3; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>`;
}

// Renders .docx files in-browser (no server-side conversion, no npm
// dependency install needed — mammoth is fetched from a CDN at runtime,
// same pattern as CodePreview's React/Babel). Legacy binary .doc isn't
// something mammoth (or any pure-JS library) can parse reliably, so that
// case is called out explicitly rather than attempting a bad conversion.
export default function DocxPreview({ dataUrl, fileName, isLegacyDoc, onDownload }) {
  const [html, setHtml] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [isLoading, setIsLoading] = useState(!isLegacyDoc);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isLegacyDoc || !dataUrl) return;
    let cancelled = false;

    // Same standard "reset loading/error before a fetch" pattern the
    // set-state-in-effect rule flags in FileViewer.jsx — not derived-state
    // syncing, so intentionally kept as-is (see the note over there).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    loadMammoth()
      .then((mammoth) => mammoth.convertToHtml({ arrayBuffer: dataUrlToArrayBuffer(dataUrl) }))
      .then((result) => {
        if (cancelled) return;
        setHtml(result.value);
        setWarnings(result.messages?.filter((m) => m.type === "warning") || []);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.message === "network" || err.message === "timeout") {
          setError("Couldn't load the document viewer from the CDN. Check your network connection and reopen this file.");
        } else {
          setError("This file doesn't look like a valid .docx — it may be corrupted or password-protected.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataUrl, isLegacyDoc]);

  if (isLegacyDoc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <AlertCircle size={20} className="text-foreground-secondary/60" />
        <div>
          <p className="text-[13px] font-medium text-foreground">Legacy .doc format isn&apos;t supported for in-browser preview</p>
          <p className="mt-1 text-[11.5px] text-foreground-secondary">
            Only modern .docx files can be rendered here. Download it and open it in Word (or re-save it as .docx) to view it.
          </p>
        </div>
        {onDownload && (
          <button
            onClick={onDownload}
            className="mt-1 flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            <Download size={13} /> Download
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-foreground-secondary">
        <Loader2 size={14} className="animate-spin" />
        Loading document...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-foreground-secondary">
        <AlertCircle size={18} className="text-red-500" />
        {error}
        {onDownload && (
          <button
            onClick={onDownload}
            className="mt-2 flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            <Download size={13} /> Download instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {warnings.length > 0 && (
        <div className="shrink-0 border-b border-border bg-amber-500/10 px-3 py-1.5 text-[10.5px] text-amber-700 dark:text-amber-400">
          Rendered with {warnings.length} formatting note{warnings.length === 1 ? "" : "s"} — some styling may not exactly match the original.
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <iframe
          title={fileName || "document"}
          srcDoc={wrapHtmlDoc(html || "")}
          sandbox=""
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}