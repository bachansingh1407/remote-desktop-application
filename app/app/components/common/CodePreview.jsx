"use client";

import { useMemo, useState } from "react";
import { buildPreviewDoc } from "@/app/lib/buildPreviewDoc";

// Read-only viewer for uploaded HTML/JSX/TSX files (see FileViewer.jsx —
// this only ever receives `imported` nodes; the editable counterpart for
// in-app-created code files is CodeFileEditor.jsx). Both share the same
// srcDoc builder from buildPreviewDoc.js so preview behavior never drifts
// between the two.
export default function CodePreview({ code, kind, fileName }) {
  const [view, setView] = useState("split"); // "code" | "split" | "preview"

  const previewDoc = useMemo(() => buildPreviewDoc(code, kind), [code, kind]);

  const showCode = view === "code" || view === "split";
  const showPreview = view === "preview" || view === "split";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background-secondary px-2 py-1.5">
        <ViewButton label="Code" active={view === "code"} onClick={() => setView("code")} />
        <ViewButton label="Split" active={view === "split"} onClick={() => setView("split")} />
        <ViewButton label="Preview" active={view === "preview"} onClick={() => setView("preview")} />
        {(kind === "jsx" || kind === "tsx") && (
          <span className="ml-auto hidden text-[10.5px] text-foreground-secondary sm:inline">
            Single-component preview — imports besides React aren&apos;t resolved
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {showCode && (
          <div className={`min-h-0 overflow-auto ${showPreview ? "w-1/2 border-r border-border" : "w-full"}`}>
            <pre className="min-h-full whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-5 text-foreground">
              {code}
            </pre>
          </div>
        )}
        {showPreview && (
          <div className={`min-h-0 bg-white ${showCode ? "w-1/2" : "w-full"}`}>
            <iframe
              key={fileName}
              title={fileName || "preview"}
              srcDoc={previewDoc}
              sandbox="allow-scripts"
              className="h-full w-full border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ViewButton({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium ${
        active ? "bg-accent text-white" : "text-foreground/65 hover:bg-foreground/5"
      }`}
    >
      {label}
    </button>
  );
}