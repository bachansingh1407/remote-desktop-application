"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw,
  Trash2, Type, Download, Save, Loader2,
} from "lucide-react";

// PDF.js needs a worker script; unpkg is the standard CDN for this.
// If you'd rather not depend on a CDN, copy pdf.worker.min.mjs from
// node_modules/pdfjs-dist/build into /public and point workerSrc there.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

function dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToDataUrl(bytes) {
  return new Promise((resolve) => {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export default function PdfViewer({ dataUrl, fileName, onSave }) {
  const [currentDataUrl, setCurrentDataUrl] = useState(dataUrl);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addingText, setAddingText] = useState(false);
  const pageWrapRef = useRef(null);

  const file = useMemo(() => ({ url: currentDataUrl }), [currentDataUrl]);

  const onDocumentLoad = ({ numPages: n }) => {
    setNumPages(n);
    setPageNumber((p) => Math.min(p, n));
  };

  const withPdfDoc = useCallback(async (mutate) => {
    setBusy(true);
    try {
      const bytes = dataUrlToBytes(currentDataUrl);
      const pdfDoc = await PDFDocument.load(bytes);
      await mutate(pdfDoc);
      const outBytes = await pdfDoc.save();
      const newDataUrl = await bytesToDataUrl(outBytes);
      setCurrentDataUrl(newDataUrl);
      setDirty(true);
    } finally {
      setBusy(false);
    }
  }, [currentDataUrl]);

  const rotatePage = () => withPdfDoc(async (pdfDoc) => {
    const page = pdfDoc.getPage(pageNumber - 1);
    page.setRotation(degrees((page.getRotation().angle + 90) % 360));
  });

  const deletePage = () => withPdfDoc(async (pdfDoc) => {
    if (pdfDoc.getPageCount() <= 1) return;
    pdfDoc.removePage(pageNumber - 1);
  });

  const handlePageClick = async (e) => {
    if (!addingText || !pageWrapRef.current) return;
    const rect = pageWrapRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    setAddingText(false);

    const text = window.prompt("Text to add:");
    if (!text) return;

    await withPdfDoc(async (pdfDoc) => {
      const page = pdfDoc.getPage(pageNumber - 1);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(text, {
        x: relX * width,
        y: height - relY * height,
        size: 14,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
  };

  const handleSave = () => {
    onSave?.(currentDataUrl);
    setDirty(false);
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = currentDataUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <ToolBtn icon={ChevronLeft} label="Previous page" disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))} />
          <span className="min-w-[64px] text-center text-[11px] text-foreground-secondary">
            {pageNumber} / {numPages ?? "…"}
          </span>
          <ToolBtn icon={ChevronRight} label="Next page" disabled={!numPages || pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} />

          <div className="mx-1 h-4 w-px bg-border" />

          <ToolBtn icon={ZoomOut} label="Zoom out" onClick={() => setScale((s) => Math.max(0.5, s - 0.15))} />
          <span className="w-10 text-center text-[11px] text-foreground-secondary">{Math.round(scale * 100)}%</span>
          <ToolBtn icon={ZoomIn} label="Zoom in" onClick={() => setScale((s) => Math.min(3, s + 0.15))} />
        </div>

        <div className="flex items-center gap-1">
          <ToolBtn icon={RotateCw} label="Rotate page" onClick={rotatePage} disabled={busy} />
          <ToolBtn icon={Type} label="Add text" onClick={() => setAddingText((v) => !v)}
            active={addingText} disabled={busy} />
          <ToolBtn icon={Trash2} label="Delete page" onClick={deletePage} disabled={busy || numPages <= 1} danger />

          <div className="mx-1 h-4 w-px bg-border" />

          <ToolBtn icon={Download} label="Download" onClick={handleDownload} />
          <button
            onClick={handleSave}
            disabled={!dirty || busy}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors
                        ${!dirty || busy ? "cursor-not-allowed text-foreground-secondary/30"
                          : "bg-accent text-white hover:opacity-90"}`}
          >
            <Save size={13} strokeWidth={1.75} />
            {dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      {addingText && (
        <div className="shrink-0 bg-accent/10 px-3 py-1.5 text-[11px] text-accent">
          Click anywhere on the page to place your text.
        </div>
      )}

      {/* page canvas */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-6">
        <div ref={pageWrapRef} onClick={handlePageClick} className={addingText ? "cursor-crosshair" : ""}>
          <Document
            file={file}
            onLoadSuccess={onDocumentLoad}
            loading={<LoadingState />}
            error={<ErrorState />}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-[0_8px_28px_rgba(0,0,0,0.4)]"
            />
          </Document>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ icon: Icon, label, onClick, disabled, active, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors
                  ${disabled ? "cursor-not-allowed text-foreground-secondary/30"
                    : active ? "bg-accent text-white"
                    : danger ? "text-red-500 hover:bg-red-500/10"
                    : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/10"}`}
    >
      <Icon size={14} strokeWidth={1.75} />
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 w-64 items-center justify-center gap-2 text-xs text-foreground-secondary">
      <Loader2 size={14} className="animate-spin" />
      Loading PDF...
    </div>
  );
}

function ErrorState() {
  return <div className="p-6 text-xs text-red-500">Couldn't load this PDF.</div>;
}