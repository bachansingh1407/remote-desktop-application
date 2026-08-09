import { create } from "zustand";
import { persist } from "zustand/middleware";

let idCounter = 1;
const nextId = () => `task-${Date.now()}-${idCounter++}`;

// Simple, self-contained persisted store — deliberately not routed through
// the backend node/file system (a to-do list isn't a "file"), so it works
// the moment it's added with zero backend changes. Lives in localStorage,
// same tier as theme/settings.
export const useTasksStore = create(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (title, list = "Inbox") => {
        if (!title.trim()) return;
        const task = {
          id: nextId(),
          title: title.trim(),
          done: false,
          list,
          createdAt: Date.now(),
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        return task.id;
      },

      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      editTask: (id, title) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id && title.trim() ? { ...t, title: title.trim() } : t)),
        })),

      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      clearCompleted: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),

      getLists: () => {
        const lists = new Set(get().tasks.map((t) => t.list || "Inbox"));
        lists.add("Inbox");
        return Array.from(lists);
      },
    }),
    { name: "tasks-storage" }
  )
);
