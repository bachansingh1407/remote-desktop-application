"use client";

import dynamic from "next/dynamic";
import FileEditor from "@/app/components/common/FileEditor";

// Every "open this file in a window" call site (Files app, Command Palette,
// AI Assistant) used to independently reimplement `node.imported ? FileViewer
// : FileEditor` — which is how HTML/JSX/TSX files created inside Campus
// (imported === false) silently fell into the Quill rich-text note editor
// instead of a real code editor, since none of those three call sites knew
// about live-code files at all. Centralizing the decision here means fixing
// it once fixes it everywhere, and any future call site gets it for free.
export const FileViewer = dynamic(() => import("@/app/components/common/FileViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">
      Loading viewer...
    </div>
  ),
});

export const CodeFileEditor = dynamic(() => import("@/app/components/common/CodeFileEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">
      Loading editor...
    </div>
  ),
});

// "html"/"htm" -> "html", "jsx" -> "jsx", "tsx" -> "tsx", else null.
export function getLiveCodeKind(name) {
  const n = (name || "").toLowerCase();
  if (n.endsWith(".html") || n.endsWith(".htm")) return "html";
  if (n.endsWith(".jsx")) return "jsx";
  if (n.endsWith(".tsx")) return "tsx";
  return null;
}

// The single source of truth for "what should open in the window for this
// file node" — used by every open-file call site.
export function getFileWindowContent(node) {
  if (!node) return null;

  const liveKind = getLiveCodeKind(node.name);

  // In-app-created HTML/JSX/TSX (not an uploaded binary) — real code editor
  // with syntax highlighting and a live executed preview, not Quill.
  if (!node.imported && liveKind) {
    return <CodeFileEditor fileId={node.id} kind={liveKind} />;
  }

  // Uploaded files (including uploaded HTML/JSX/TSX, images, PDFs, docx,
  // etc.) — FileViewer picks the right read-only viewer internally.
  if (node.imported) {
    return <FileViewer fileId={node.id} />;
  }

  // Plain in-app note — rich text.
  return <FileEditor fileId={node.id} />;
}

// Live-code files need the extra width for a side-by-side code+preview
// split; everything else keeps the smaller default note/viewer size.
export function getFileWindowSize(node) {
  if (node && !node.imported && getLiveCodeKind(node.name)) {
    return { width: 920, height: 600, minWidth: 640, minHeight: 420 };
  }
  if (node?.imported) return { width: 760, height: 560 };
  return { width: 700, height: 480 };
}

// Minimal starter content so a freshly created live-code file shows
// something real in Preview immediately instead of a blank white iframe.
export function getStarterContent(liveKind) {
  if (liveKind === "html") {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Untitled</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 40px; color: #1a1a1a; }
    </style>
  </head>
  <body>
    <h1>Hello, world</h1>
    <p>Edit this file and the preview updates automatically.</p>
  </body>
</html>
`;
  }
  if (liveKind === "jsx" || liveKind === "tsx") {
    return `export default function App() {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <h1>Hello, world</h1>
      <p>Edit this component and the preview updates automatically.</p>
    </div>
  );
}
`;
  }
  return "";
}