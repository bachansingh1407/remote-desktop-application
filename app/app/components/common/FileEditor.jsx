"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useFileSystemStore } from "@/app/stores";

const QuillEditor = dynamic(() => import("./QuillEditor"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">Loading editor...</div>,
});

// No internal filename header here on purpose — the window titlebar
// (set via openWindow({ title: node.name })) already shows the name.
// Adding a second header here would duplicate it ("two heads").
export default function FileEditor({ fileId }) {
  const file = useFileSystemStore((s) => s.items[fileId]);
  const updateFileContent = useFileSystemStore((s) => s.updateFileContent);
  const saveTimer = useRef(null);
  const [savedLabel, setSavedLabel] = useState("Saved");

  const handleChange = (html) => {
    setSavedLabel("Saving...");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateFileContent(fileId, html);
        setSavedLabel("Saved");
      } catch {
        setSavedLabel("Save failed — retrying...");
        // One retry after a beat — covers a transient network blip without
        // silently losing the person's edit or nagging them to act.
        setTimeout(async () => {
          try {
            await updateFileContent(fileId, html);
            setSavedLabel("Saved");
          } catch {
            setSavedLabel("Save failed");
          }
        }, 1500);
      }
    }, 500);
  };

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!file) return <div className="p-4 text-xs text-foreground-secondary">File not found.</div>;

  return (
    <div className="relative flex h-full flex-col bg-white">
      <span className="pointer-events-none absolute right-3 top-2 z-10 text-[10px] text-black/35">
        {savedLabel}
      </span>
      <div className="min-h-0 flex-1 overflow-hidden">
        <QuillEditor value={file.content} onChange={handleChange} placeholder="Start writing..." />
      </div>
    </div>
  );
}