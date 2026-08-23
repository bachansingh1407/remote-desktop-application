"use client";

import { useCallback, useRef, useState } from "react";
import { Plus, X, Palette } from "lucide-react";
import { useStickyNotesStore, NOTE_COLORS } from "@/app/stores";

// A genuinely new, lightweight desktop feature — quick-capture notes you
// drag around a corkboard, distinct from Write (which is a real
// file-backed document) and from Tasks (a checklist). Self-contained in
// localStorage, no backend involved, so it works the instant it's added.
function StickyNote({ note, boardRef, onFocus, zIndex }) {
  const updateNote = useStickyNotesStore((s) => s.updateNote);
  const moveNote = useStickyNotesStore((s) => s.moveNote);
  const recolorNote = useStickyNotesStore((s) => s.recolorNote);
  const deleteNote = useStickyNotesStore((s) => s.deleteNote);
  const [showColors, setShowColors] = useState(false);
  const dragRef = useRef(null);

  const handlePointerDown = useCallback(
    (e) => {
      // Don't start a drag from the textarea, delete button, or color
      // swatches — those need normal click/typing behavior.
      if (e.target.closest("[data-no-drag]")) return;
      onFocus(note.id);
      const board = boardRef.current;
      if (!board) return;
      const boardRect = board.getBoundingClientRect();
      const startX = e.clientX - note.x;
      const startY = e.clientY - note.y;

      const onMove = (ev) => {
        const maxX = boardRect.width - 176;
        const maxY = boardRect.height - 176;
        const nx = Math.min(Math.max(ev.clientX - startX, 0), Math.max(maxX, 0));
        const ny = Math.min(Math.max(ev.clientY - startY, 0), Math.max(maxY, 0));
        dragRef.current = { x: nx, y: ny };
        e.currentTarget?.style && (e.currentTarget.style.transform = `translate(${nx}px, ${ny}px)`);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (dragRef.current) moveNote(note.id, dragRef.current.x, dragRef.current.y);
        dragRef.current = null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [note.id, note.x, note.y, boardRef, moveNote, onFocus]
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      style={{ left: note.x, top: note.y, backgroundColor: note.color, zIndex }}
      className="absolute flex h-44 w-44 cursor-grab select-none flex-col rounded-md shadow-[0_6px_16px_rgba(0,0,0,0.18)] active:cursor-grabbing"
    >
      <div className="flex shrink-0 items-center justify-between px-1.5 pt-1.5">
        <button
          data-no-drag
          onClick={() => setShowColors((v) => !v)}
          className="rounded p-1 text-black/40 hover:bg-black/[0.06] hover:text-black/70"
        >
          <Palette size={12} />
        </button>
        <button
          data-no-drag
          onClick={() => deleteNote(note.id)}
          className="rounded p-1 text-black/40 hover:bg-black/[0.06] hover:text-black/70"
        >
          <X size={13} />
        </button>
      </div>

      {showColors && (
        <div data-no-drag className="flex items-center justify-center gap-1 px-2 pb-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                recolorNote(note.id, c);
                setShowColors(false);
              }}
              style={{ backgroundColor: c }}
              className={`h-4 w-4 rounded-full border ${c === note.color ? "border-black/50" : "border-black/10"}`}
            />
          ))}
        </div>
      )}

      <textarea
        data-no-drag
        value={note.text}
        onChange={(e) => updateNote(note.id, e.target.value)}
        placeholder="Type something..."
        className="min-h-0 flex-1 resize-none bg-transparent px-3 pb-3 text-[12.5px] leading-5 text-black/80 outline-none placeholder-black/35"
      />
    </div>
  );
}

export default function StickyNotesApp() {
  const notes = useStickyNotesStore((s) => s.notes);
  const addNote = useStickyNotesStore((s) => s.addNote);
  const boardRef = useRef(null);
  const [focusOrder, setFocusOrder] = useState([]);

  const handleFocus = (id) => setFocusOrder((prev) => [...prev.filter((n) => n !== id), id]);
  const zIndexFor = (id) => {
    const i = focusOrder.indexOf(id);
    return i === -1 ? 1 : i + 1;
  };

  return (
    <div className="flex h-full flex-col bg-[repeating-linear-gradient(45deg,rgba(0,0,0,0.015)_0px,rgba(0,0,0,0.015)_1px,transparent_1px,transparent_10px)] bg-background-secondary">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <p className="text-[12px] text-foreground-secondary">
          {notes.length} note{notes.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={addNote}
          className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11.5px] font-medium text-white hover:opacity-90"
        >
          <Plus size={13} /> New note
        </button>
      </div>

      <div ref={boardRef} className="relative flex-1 overflow-hidden">
        {notes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center text-foreground-secondary">
            <p className="text-[12.5px]">No notes yet</p>
            <p className="text-[11px] opacity-70">Quick thoughts that don&apos;t need a real file.</p>
          </div>
        )}
        {notes.map((note) => (
          <StickyNote key={note.id} note={note} boardRef={boardRef} onFocus={handleFocus} zIndex={zIndexFor(note.id)} />
        ))}
      </div>
    </div>
  );
}
