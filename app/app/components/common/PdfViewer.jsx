"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw,
  Trash2, Type, Download, Save, Loader2, FileWarning,
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
  const [pageNumber, setPageNumber] = useState(1); // "page currently in view", tracked via scroll
  const [scale, setScale] = useState(1.1);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addingText, setAddingText] = useState(false);

  const scrollRef = useRef(null);
  const pageRefs = useRef([]);

  const file = useMemo(() => ({ url: currentDataUrl }), [currentDataUrl]);

  const onDocumentLoad = ({ numPages: n }) => {
    pageRefs.current = new Array(n).fill(null);
    setNumPages(n);
    setPageNumber((p) => Math.min(p, n));
  };

  // Continuous scroll means every page is mounted at once — this watches
  // which page is actually in view and keeps the toolbar's page counter
  // (and rotate/delete's page target) in sync with what the user is
  // actually looking at, instead of a separate "current page" concept.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !numPages) return;

    const visibility = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(Number(entry.target.dataset.pageIndex), entry.intersectionRatio);
        });
        let bestIndex = null;
        let bestRatio = 0;
        visibility.forEach((ratio, index) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestIndex = index;
          }
        });
        if (bestIndex !== null) setPageNumber(bestIndex + 1);
      },
      { root, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    pageRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [numPages]);

  const scrollToPage = (target) => {
    if (!numPages) return;
    const index = Math.min(Math.max(target, 1), numPages) - 1;
    pageRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const handlePageClick = async (e, pageIndex) => {
    if (!addingText) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    setAddingText(false);

    const text = window.prompt("Text to add:");
    if (!text) return;

    await withPdfDoc(async (pdfDoc) => {
      const page = pdfDoc.getPage(pageIndex);
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
      {/* toolbar — glassy, matches the rest of the app's window chrome */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background-elevated px-3 py-2.5 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-1">
          <ToolBtn icon={ChevronLeft} label="Previous page" disabled={pageNumber <= 1}
            onClick={() => scrollToPage(pageNumber - 1)} />
          <span className="min-w-[68px] rounded-md bg-foreground/[0.04] px-2 py-1 text-center text-[11px] font-medium text-foreground-secondary">
            {pageNumber} / {numPages ?? "…"}
          </span>
          <ToolBtn icon={ChevronRight} label="Next page" disabled={!numPages || pageNumber >= numPages}
            onClick={() => scrollToPage(pageNumber + 1)} />

          <div className="mx-1.5 h-4 w-px bg-border" />

          <ToolBtn icon={ZoomOut} label="Zoom out" onClick={() => setScale((s) => Math.max(0.5, s - 0.15))} />
          <span className="w-11 text-center text-[11px] font-medium text-foreground-secondary">{Math.round(scale * 100)}%</span>
          <ToolBtn icon={ZoomIn} label="Zoom in" onClick={() => setScale((s) => Math.min(3, s + 0.15))} />
        </div>

        <div className="flex items-center gap-1">
          <ToolBtn icon={RotateCw} label="Rotate page" onClick={rotatePage} disabled={busy} />
          <ToolBtn icon={Type} label="Add text" onClick={() => setAddingText((v) => !v)}
            active={addingText} disabled={busy} />
          <ToolBtn icon={Trash2} label="Delete page" onClick={deletePage} disabled={busy || numPages <= 1} danger />

          <div className="mx-1.5 h-4 w-px bg-border" />

          <ToolBtn icon={Download} label="Download" onClick={handleDownload} />
          <button
            onClick={handleSave}
            disabled={!dirty || busy}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150
                        ${!dirty || busy ? "cursor-not-allowed text-foreground-secondary/30"
                          : "bg-accent text-white shadow-sm hover:opacity-90 active:scale-95"}`}
          >
            <Save size={13} strokeWidth={1.9} />
            {dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      {addingText && (
        <div className="animate-fade-in shrink-0 border-b border-accent/20 bg-accent/[0.08] px-3 py-1.5 text-center text-[11px] font-medium text-accent">
          Click anywhere on a page to place your text
        </div>
      )}

      {/* page canvas — recessed "tray" with a soft vignette, pages float on top */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="h-full overflow-auto bg-foreground/[0.035] shadow-[inset_0_10px_18px_-14px_rgba(0,0,0,0.35),inset_0_-10px_18px_-14px_rgba(0,0,0,0.35)]"
        >
          <div className="flex flex-col items-center gap-7 px-6 py-9">
            <Document
              file={file}
              onLoadSuccess={onDocumentLoad}
              loading={<LoadingState />}
              error={<ErrorState />}
            >
              {numPages &&
                Array.from({ length: numPages }, (_, i) => (
                  <div
                    key={i}
                    ref={(el) => (pageRefs.current[i] = el)}
                    data-page-index={i}
                    onClick={(e) => handlePageClick(e, i)}
                    className={`overflow-hidden rounded-[3px] shadow-[0_10px_32px_-6px_rgba(0,0,0,0.4)] ring-1 ring-black/5 transition-shadow duration-150
                      ${addingText ? "cursor-crosshair hover:ring-2 hover:ring-accent/50" : ""}`}
                  >
                    <Page
                      pageNumber={i + 1}
                      scale={scale}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading={<PageSkeleton scale={scale} />}
                    />
                  </div>
                ))}
            </Document>
          </div>
        </div>

        {/* floating page indicator — stays put while pages scroll underneath */}
        {numPages && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="pointer-events-auto rounded-full border border-border bg-background-elevated px-3.5 py-1.5 text-[11px] font-medium text-foreground shadow-[0_10px_28px_rgba(0,0,0,0.22)] backdrop-blur-2xl backdrop-saturate-150">
              Page {pageNumber} of {numPages}
            </div>
          </div>
        )}
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
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150
                  ${disabled ? "cursor-not-allowed text-foreground-secondary/30"
                    : active ? "bg-accent text-white shadow-sm"
                    : danger ? "text-red-500 hover:bg-red-500/10 active:scale-90"
                    : "text-foreground-secondary hover:bg-foreground/[0.06] hover:text-foreground active:scale-90"}`}
    >
      <Icon size={14} strokeWidth={1.85} />
    </button>
  );
}

function PageSkeleton({ scale }) {
  return (
    <div
      className="animate-pulse bg-foreground/[0.06]"
      style={{ width: 612 * scale, height: 792 * scale }}
    />
  );
}

function LoadingState() {
  return (
    <div className="flex h-72 w-[420px] max-w-full flex-col items-center justify-center gap-2.5 rounded-[3px] bg-foreground/[0.04] text-xs text-foreground-secondary">
      <Loader2 size={18} className="animate-spin text-accent" />
      Loading PDF…
    </div>
  );
}

function ErrorState() {
  return (
    <div className="flex h-52 w-[360px] max-w-full flex-col items-center justify-center gap-2.5 rounded-[3px] border border-dashed border-border text-center text-xs text-foreground-secondary">
      <FileWarning size={20} className="text-red-500" />
      Couldn't load this PDF.
    </div>
  );
}