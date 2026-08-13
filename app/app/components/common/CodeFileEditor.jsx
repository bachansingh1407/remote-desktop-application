"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html as htmlLang } from "@codemirror/lang-html";
import { javascript as jsLang } from "@codemirror/lang-javascript";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
import { useFileSystemStore, useThemeStore } from "@/app/stores";
import { buildPreviewDoc } from "@/app/lib/buildPreviewDoc";

// Editable counterpart to CodePreview.jsx (which is read-only, for
// uploaded files). This one is for HTML/JSX/TSX files created inside
// Campus itself — real syntax highlighting via CodeMirror instead of the
// old behavior of silently opening them in the Quill rich-text note editor
// (which mangled source code into formatted paragraphs). Saves through the
// same updateFileContent action FileEditor uses, since these are still
// plain-text notes under the hood — only the editor widget differs.
export default function CodeFileEditor({ fileId, kind }) {
  const file = useFileSystemStore((s) => s.items[fileId]);
  const updateFileContent = useFileSystemStore((s) => s.updateFileContent);
  const theme = useThemeStore((s) => s.theme);

  const [code, setCode] = useState(file?.content ?? "");
  const [previewCode, setPreviewCode] = useState(file?.content ?? "");
  const [view, setView] = useState("split"); // "code" | "split" | "preview"
  const [savedLabel, setSavedLabel] = useState("Saved");

  const saveTimer = useRef(null);
  const previewTimer = useRef(null);

  // Preview re-renders on a short debounce rather than every keystroke —
  // the iframe does a full reload (CDN scripts included) on each change,
  // so live-updating on every character would be both janky and wasteful.
  useEffect(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewCode(code), 500);
    return () => clearTimeout(previewTimer.current);
  }, [code]);

  const handleChange = useCallback(
    (value) => {
      setCode(value);
      setSavedLabel("Saving...");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await updateFileContent(fileId, value);
          setSavedLabel("Saved");
        } catch {
          setSavedLabel("Save failed — retrying...");
          setTimeout(async () => {
            try {
              await updateFileContent(fileId, value);
              setSavedLabel("Saved");
            } catch {
              setSavedLabel("Save failed");
            }
          }, 1500);
        }
      }, 600);
    },
    [fileId, updateFileContent]
  );

  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(previewTimer.current);
    },
    []
  );

  const langExtension = useMemo(() => {
    if (kind === "html") return [htmlLang()];
    if (kind === "tsx") return [jsLang({ jsx: true, typescript: true })];
    return [jsLang({ jsx: true })]; // jsx
  }, [kind]);

  const previewDoc = useMemo(() => buildPreviewDoc(previewCode, kind), [previewCode, kind]);

  const showCode = view === "code" || view === "split";
  const showPreview = view === "preview" || view === "split";

  if (!file) return <div className="p-4 text-xs text-foreground-secondary">File not found.</div>;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background-secondary px-2 py-1.5">
        <ViewButton label="Code" active={view === "code"} onClick={() => setView("code")} />
        <ViewButton label="Split" active={view === "split"} onClick={() => setView("split")} />
        <ViewButton label="Preview" active={view === "preview"} onClick={() => setView("preview")} />
        <span className="ml-auto text-[10.5px] text-foreground-secondary">{savedLabel}</span>
      </div>

      <div className="flex min-h-0 flex-1">
        {showCode && (
          <div className={`min-h-0 overflow-auto ${showPreview ? "w-1/2 border-r border-border" : "w-full"}`}>
            <CodeMirror
              value={code}
              onChange={handleChange}
              extensions={langExtension}
              theme={theme === "dark" ? githubDark : githubLight}
              height="100%"
              basicSetup={{ foldGutter: true, autocompletion: true }}
              style={{ height: "100%", fontSize: "12.5px" }}
            />
          </div>
        )}
        {showPreview && (
          <div className={`min-h-0 bg-white ${showCode ? "w-1/2" : "w-full"}`}>
            <iframe
              title={file.name || "preview"}
              srcDoc={previewDoc}
              sandbox="allow-scripts"
              className="h-full w-full border-0"
            />
          </div>
        )}
      </div>

      {(kind === "jsx" || kind === "tsx") && (
        <div className="shrink-0 border-t border-border bg-background-secondary px-2 py-1 text-[10px] text-foreground-secondary">
          Single-component preview — imports besides React aren&apos;t resolved
        </div>
      )}
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