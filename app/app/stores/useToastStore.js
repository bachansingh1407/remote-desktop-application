import { create } from "zustand";

let idCounter = 1;

// Not persisted — toasts are transient, session-only feedback (file saved,
// action failed, etc.), never something that should survive a reload.
export const useToastStore = create((set, get) => ({
  toasts: [],

  push: ({ title, description, variant = "default", duration = 3200 }) => {
    const id = idCounter++;
    set((s) => ({ toasts: [...s.toasts, { id, title, description, variant }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Small convenience wrapper so call sites don't need to import the whole
// store just to fire a one-off toast.
export const toast = {
  success: (title, description) => useToastStore.getState().push({ title, description, variant: "success" }),
  error: (title, description) => useToastStore.getState().push({ title, description, variant: "error" }),
  info: (title, description) => useToastStore.getState().push({ title, description, variant: "default" }),
};
