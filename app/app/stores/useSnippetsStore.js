import { create } from "zustand";
import { persist } from "zustand/middleware";

let idCounter = 1;
const nextId = () => `snip-${Date.now()}-${idCounter++}`;

export const LANGUAGES = [
  "text", "javascript", "typescript", "python", "bash", "json",
  "html", "css", "sql", "markdown",
];

export const useSnippetsStore = create(
  persist(
    (set) => ({
      snippets: [],

      addSnippet: ({ title, language = "text", code = "" }) => {
        const snippet = {
          id: nextId(),
          title: title?.trim() || "Untitled snippet",
          language,
          code,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({ snippets: [snippet, ...s.snippets] }));
        return snippet.id;
      },

      updateSnippet: (id, patch) =>
        set((s) => ({
          snippets: s.snippets.map((sn) =>
            sn.id === id ? { ...sn, ...patch, updatedAt: Date.now() } : sn
          ),
        })),

      deleteSnippet: (id) => set((s) => ({ snippets: s.snippets.filter((sn) => sn.id !== id) })),
    }),
    { name: "snippets-storage" }
  )
);
