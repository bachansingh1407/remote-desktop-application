"use client";

import { useEffect, useState } from "react";
import { Smartphone, Tablet, Monitor, Code2, SplitSquareVertical } from "lucide-react";
import { fetchFileText } from "@/app/lib/axios";

export default function HtmlViewer({ fileId }) {
  const [html, setHtml] = useState("");
  const [mode, setMode] = useState("split");
  const [device, setDevice] = useState("desktop");

useEffect(() => {
  let cancelled = false;

  fetchFileText(fileId)
    .then((text) => {
      if (!cancelled) {
        setHtml(text);
      }
    })
    .catch(console.error);

  return () => {
    cancelled = true;
  };
}, [fileId]);

  const previewWidth =
    device === "mobile"
      ? 390
      : device === "tablet"
        ? 768
        : "100%";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}

      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <ToolbarButton
            active={mode === "code"}
            onClick={() => setMode("code")}
            icon={Code2}
          />

          <ToolbarButton
            active={mode === "split"}
            onClick={() => setMode("split")}
            icon={SplitSquareVertical}
          />

          <ToolbarButton
            active={mode === "preview"}
            onClick={() => setMode("preview")}
            icon={Monitor}
          />
        </div>

        <div className="flex items-center gap-1">
          <ToolbarButton
            active={device === "mobile"}
            onClick={() => setDevice("mobile")}
            icon={Smartphone}
          />

          <ToolbarButton
            active={device === "tablet"}
            onClick={() => setDevice("tablet")}
            icon={Tablet}
          />

          <ToolbarButton
            active={device === "desktop"}
            onClick={() => setDevice("desktop")}
            icon={Monitor}
          />
        </div>
      </div>

      {/* Code Only */}

      {mode === "code" && (
        <div className="h-full overflow-auto bg-[#0d1117] p-4 font-mono text-sm text-slate-200">
          <pre>{html}</pre>
        </div>
      )}

      {/* Preview Only */}

      {mode === "preview" && (
        <div className="flex h-full justify-center overflow-auto bg-muted p-4">
          <iframe
            sandbox="allow-scripts allow-same-origin"
            srcDoc={html}
            style={{
              width: previewWidth,
              height: "100%",
            }}
            className="rounded-lg border bg-white shadow-xl"
          />
        </div>
      )}

      {/* Split */}

      {mode === "split" && (
        <div className="flex h-full">
          <div className="w-1/2 overflow-auto bg-[#0d1117] p-4 font-mono text-sm text-slate-200">
            <pre>{html}</pre>
          </div>

          <div className="flex flex-1 justify-center overflow-auto bg-muted p-4">
            <iframe
              sandbox="allow-scripts allow-same-origin"
              srcDoc={html}
              style={{
                width: previewWidth,
                height: "100%",
              }}
              className="rounded-lg border bg-white shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon: Icon,
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors
      ${active
          ? "bg-accent text-white"
          : "hover:bg-black/5 dark:hover:bg-white/10"
        }`}
    >
      <Icon size={16} />
    </button>
  );
}