"use client";

import { useMemo, useState } from "react";

// .html files are usually already a complete document — render as-is.
function buildHtmlPreviewDoc(code) {
  return code;
}

// .jsx has no bundler behind it here, so this only handles a single
// self-contained component: React/ReactDOM/Babel/Tailwind are injected
// into the iframe, `import` lines are stripped, and `export default` is
// rewired into an auto-mount. Imports of local files/CSS aren't resolved.
function buildJsxPreviewDoc(code) {
  const processed = code
    .replace(/^\s*import[^;]*;?\s*$/gm, "")
    .replace(/export\s+default\s+/, "const __PreviewRoot = ")
    .replace(/^export\s+(?=const|function|class|let|var)/gm, "");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      html, body { margin: 0; padding: 12px; font-family: ui-sans-serif, system-ui, sans-serif; }
      #root { min-height: calc(100vh - 24px); }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="text/babel" data-presets="react">
${processed}

      (function () {
        var target = document.getElementById("root");
        try {
          var Comp = typeof __PreviewRoot !== "undefined" ? __PreviewRoot : null;
          if (Comp) {
            var root = ReactDOM.createRoot(target);
            root.render(typeof Comp === "function" ? React.createElement(Comp) : Comp);
          } else {
            target.innerHTML =
              '<div style="font:12px monospace;color:#888">No default export found — add <code>export default function App() {...}</code> to preview it here.</div>';
          }
        } catch (err) {
          target.innerHTML =
            '<pre style="color:#e11d48;font:11px monospace;white-space:pre-wrap">' +
            (err && err.message ? err.message : String(err)) +
            "</pre>";
        }
      })();
    </script>
  </body>
</html>`;
}

export default function CodePreview({ code, kind, fileName }) {
  const [view, setView] = useState("split"); // "code" | "split" | "preview"

  const previewDoc = useMemo(() => {
    if (kind === "jsx") return buildJsxPreviewDoc(code || "");
    return buildHtmlPreviewDoc(code || "");
  }, [code, kind]);

  const showCode = view === "code" || view === "split";
  const showPreview = view === "preview" || view === "split";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background-secondary px-2 py-1.5">
        <ViewButton label="Code" active={view === "code"} onClick={() => setView("code")} />
        <ViewButton label="Split" active={view === "split"} onClick={() => setView("split")} />
        <ViewButton label="Preview" active={view === "preview"} onClick={() => setView("preview")} />
        {kind === "jsx" && (
          <span className="ml-auto hidden text-[10.5px] text-foreground-secondary sm:inline">
            Single-component preview — imports besides React aren't resolved
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