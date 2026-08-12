"use client";

import { useMemo, useState } from "react";

// .html files are usually already a complete document — render as-is.
function buildHtmlPreviewDoc(code) {
  return code;
}

// .jsx/.tsx have no bundler behind them here, so this only handles a
// single self-contained component: React/ReactDOM/Babel/Tailwind are
// injected into the iframe, `import` lines are stripped, and
// `export default` is rewired into an auto-mount. Imports of local
// files/CSS aren't resolved. For .tsx, Babel's TypeScript preset strips
// type annotations at transform time — no separate type-checking step.
//
// The CDN scripts (React/Babel/Tailwind) are loaded with onerror/onload
// hooks and a timeout fallback below, so a blocked/unreachable CDN (e.g.
// no internet in this environment, or a network policy) shows a clear
// message instead of a silently blank preview.
function buildComponentPreviewDoc(code, kind) {
  const processed = code
    .replace(/^\s*import[^;]*;?\s*$/gm, "")
    .replace(/export\s+default\s+/, "const __PreviewRoot = ")
    .replace(/^export\s+(?=const|function|class|let|var|interface|type)/gm, "");

  const babelPresets = kind === "tsx" ? "react,typescript" : "react";
  // Babel's standalone TS preset needs the filename to end in .tsx to know
  // to parse JSX inside a .ts-flavored file (otherwise `<Foo>` reads as a
  // type assertion and throws).
  const scriptType = kind === "tsx" ? "text/babel" : "text/babel";
  const babelFilename = kind === "tsx" ? "preview.tsx" : "preview.jsx";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://unpkg.com/react@18/umd/react.development.js" onload="window.__depOk('react')" onerror="window.__depFail('React')"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" onload="window.__depOk('reactDom')" onerror="window.__depFail('ReactDOM')"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js" onload="window.__depOk('babel')" onerror="window.__depFail('Babel')"></script>
    <script src="https://cdn.tailwindcss.com" onerror="window.__depFail('Tailwind (styling only — preview still works)', true)"></script>
    <style>
      html, body { margin: 0; padding: 12px; font-family: ui-sans-serif, system-ui, sans-serif; }
      #root { min-height: calc(100vh - 24px); }
    </style>
    <script>
      window.__deps = { react: false, reactDom: false, babel: false };
      window.__depOk = function (name) { window.__deps[name] = true; };
      window.__depFail = function (label, nonFatal) {
        var target = document.getElementById('root');
        if (!target) return;
        if (nonFatal) {
          console.warn(label + ' failed to load — continuing without it.');
          return;
        }
        target.innerHTML =
          '<div style="font:12px ui-sans-serif,system-ui,sans-serif;color:#b91c1c;padding:8px;line-height:1.5">' +
          '<b>Couldn\\'t load ' + label + ' from the CDN.</b><br/>' +
          'This preview needs internet access to fetch React/Babel. Check your network connection (or the sandbox\\'s network policy) and reopen this file.' +
          '</div>';
      };
      // Fallback: if the "load" events above never fire within 8s (blocked
      // domain, DNS failure, etc. — which doesn't always trigger onerror),
      // show the same message instead of an indefinitely blank preview.
      window.setTimeout(function () {
        if (!window.__deps.react || !window.__deps.reactDom || !window.__deps.babel) {
          window.__depFail('React/Babel');
        }
      }, 8000);
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="${scriptType}" data-presets="${babelPresets}" data-filename="${babelFilename}">
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
    if (kind === "jsx" || kind === "tsx") return buildComponentPreviewDoc(code || "", kind);
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