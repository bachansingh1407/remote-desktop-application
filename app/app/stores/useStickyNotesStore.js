import { create } from "zustand";
import { persist } from "zustand/middleware";

let idCounter = 1;
const nextId = () => `note-${Date.now()}-${idCounter++}`;

export const NOTE_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA", "#DDD6FE"];

// Same pattern as useTasksStore: a self-contained, localStorage-persisted
// store, not routed through the backend node/file system, since a sticky
// note is closer to desktop chrome than a document. Positions are stored
// so notes stay where the person left them across sessions, like real
// desktop stickies.
export const useStickyNotesStore = create(
  persist(
    (set, get) => ({
      notes: [],

      addNote: () => {
        const count = get().notes.length;
        const note = {
          id: nextId(),
          text: "",
          color: NOTE_COLORS[count % NOTE_COLORS.length],
          x: 40 + (count % 6) * 24,
          y: 40 + (count % 6) * 24,
          createdAt: Date.now(),
        };
        set((s) => ({ notes: [...s.notes, note] }));
        return note.id;
      },

      updateNote: (id, text) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, text } : n)) })),

      moveNote: (id, x, y) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, x, y } : n)) })),

      recolorNote: (id, color) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, color } : n)) })),

      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
    }),
    { name: "sticky-notes-storage" }
  )
);
