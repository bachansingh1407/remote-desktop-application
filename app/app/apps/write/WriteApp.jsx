"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Save, FolderOpen, FilePlus2, ChevronDown } from "lucide-react";
import { useFileSystemStore, useWindowStore } from "@/app/stores";
import { toast } from "@/app/stores/useToastStore";
import FolderPickerModal from "@/app/components/common/FolderPickerModal";

const QuillEditor = dynamic(() => import("@/app/components/common/QuillEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-foreground-secondary">
      Loading editor...
    </div>
  ),
});

// Unlike v1 (local state only, lost on close), Write is now a real
// file-system-backed editor: nothing is a document until it's actually
// saved somewhere the user chose, then every further keystroke autosaves
// to that same node — same contract as double-clicking a file in Files.
export default function WriteApp() {
  const [content, setContent] = useState("");
  const [fileId, setFileId] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [status, setStatus] = useState("New document");
  const [pickerMode, setPickerMode] = useState(null); // "save" | "open" | null
  const [dirty, setDirty] = useState(false);

  const createFile = useFileSystemStore((s) => s.createFile);
  const updateFileContent = useFileSystemStore((s) => s.updateFileContent);
  const items = useFileSystemStore((s) => s.items);
  const setWindowTitle = useWindowStore((s) => s.setWindowTitle);
  const saveTimer = useRef(null);

  // Keep the taskbar/window title in sync with whatever's actually open.
  useEffect(() => {
    setWindowTitle("write", fileName ? fileName : "Write");
  }, [fileName, setWindowTitle]);

  const handleChange = useCallback(
    (html) => {
      setContent(html);
      setDirty(true);
      if (!fileId) {
        setStatus("Not saved");
        return;
      }
      setStatus("Saving...");
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await updateFileContent(fileId, html);
          setStatus("Saved");
          setDirty(false);
        } catch {
          setStatus("Save failed");
        }
      }, 500);
    },
    // Recreated whenever the open file changes — that also clears any
    // in-flight debounce for the previous file, so a save never lands on
    // the wrong document after switching.
    [updateFileContent, fileId]
  );

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const handleNew = () => {
    if (dirty && !window.confirm("Discard unsaved changes and start a new document?")) return;
    setFileId(null);
    setFileName(null);
    setContent("");
    setStatus("New document");
    setDirty(false);
  };

  const handleSaveClick = () => {
    if (fileId) {
      // Already backed by a file — just force an immediate save.
      clearTimeout(saveTimer.current);
      updateFileContent(fileId, content)
        .then(() => {
          setStatus("Saved");
          setDirty(false);
          toast.success("Saved", fileName);
        })
        .catch((err) => toast.error("Couldn't save", err.response?.data?.message || err.message));
      return;
    }
    setPickerMode("save");
  };

  const handleSaveAs = () => setPickerMode("save");
  const handleOpen = () => setPickerMode("open");

  const handleConfirmSave = async ({ folderId, filename }) => {
    setPickerMode(null);
    try {
      const id = await createFile(folderId, filename, content);
      setFileId(id);
      setFileName(filename);
      setStatus("Saved");
      setDirty(false);
      toast.success("Saved", filename);
    } catch (err) {
      toast.error("Couldn't save", err.response?.data?.message || err.message);
    }
  };

  const handleSelectFile = (node) => {
    setPickerMode(null);
    setFileId(node.id);
    setFileName(node.name);
    setContent(items[node.id]?.content ?? "");
    setStatus("Saved");
    setDirty(false);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-black/10 bg-white px-2 py-1.5">
        <ToolbarButton icon={FilePlus2} label="New" onClick={handleNew} />
        <ToolbarButton icon={FolderOpen} label="Open" onClick={handleOpen} />
        <div className="mx-1 flex items-center">
          <button
            onClick={handleSaveClick}
            className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11.5px] font-medium text-white hover:opacity-90"
          >
            <Save size={12} /> Save
          </button>
          {fileId && (
            <button
              onClick={handleSaveAs}
              title="Save As — save a copy somewhere else"
              className="flex items-center rounded-md px-1 py-1.5 text-black/50 hover:bg-black/[0.05]"
            >
              <ChevronDown size={12} />
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {fileName && <span className="text-[11px] font-medium text-black/60">{fileName}</span>}
          <span className={`text-[10.5px] ${status === "Save failed" ? "text-red-500" : "text-black/35"}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <QuillEditor value={content} onChange={handleChange} placeholder="Start writing your article..." />
      </div>

      <FolderPickerModal
        open={pickerMode === "save"}
        onClose={() => setPickerMode(null)}
        onConfirm={handleConfirmSave}
        initialFilename={fileName ?? "Untitled document"}
        confirmLabel="Save"
        title="Save document"
        mode="save"
      />
      <FolderPickerModal
        open={pickerMode === "open"}
        onClose={() => setPickerMode(null)}
        onSelectFile={handleSelectFile}
        title="Open document"
        mode="open"
      />
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11.5px] font-medium text-black/65 hover:bg-black/[0.05]"
    >
      <Icon size={12} /> {label}
    </button>
  );
}
