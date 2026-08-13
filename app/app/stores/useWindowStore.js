import { create } from "zustand";
import { DEFAULT_WINDOW } from "../lib/constants";

let zCounter = 10;

export const useWindowStore = create((set, get) => ({
  windows: [],

  openWindow: ({
    id,
    title,
    content,
    width = DEFAULT_WINDOW.width,
    height = DEFAULT_WINDOW.height,
    minWidth = DEFAULT_WINDOW.minWidth,
    minHeight = DEFAULT_WINDOW.minHeight,
  }) => {
    const existing = get().windows.find((w) => w.id === id);

    if (existing) {
      zCounter += 1;
      set((state) => ({
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, zIndex: zCounter, minimized: false } : w
        ),
      }));
      return;
    }

    zCounter += 1;
    const offset = get().windows.length * 24;

    set((state) => ({
      windows: [
        ...state.windows,
        {
          id,
          title,
          content,
          width,
          height,
          minWidth,
          minHeight,
          x: 120 + offset,
          y: 80 + offset,
          zIndex: zCounter,
          minimized: false,
          maximized: false,
        },
      ],
    }));
  },

  closeWindow: (id) =>
    set((state) => ({ windows: state.windows.filter((w) => w.id !== id) })),

  closeAllWindows: () => set({ windows: [] }),

  focusWindow: (id) => {
    zCounter += 1;
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, zIndex: zCounter } : w
      ),
    }));
  },

  minimizeWindow: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w
      ),
    })),

  // Used by the taskbar's "show desktop" strip — minimizes every open
  // window in one shot. Returns the ids that were actually visible before
  // the call, so the caller can restore exactly those (and only those) on
  // a second press, matching the classic show-desktop "peek" toggle.
  minimizeAllWindows: () => {
    const visibleIds = get()
      .windows.filter((w) => !w.minimized)
      .map((w) => w.id);
    set((state) => ({
      windows: state.windows.map((w) => ({ ...w, minimized: true })),
    }));
    return visibleIds;
  },

  restoreWindows: (ids) => {
    if (!ids?.length) return;
    zCounter += 1;
    const targetZ = zCounter;
    set((state) => ({
      windows: state.windows.map((w) =>
        ids.includes(w.id) ? { ...w, minimized: false, zIndex: targetZ } : w
      ),
    }));
  },

  restoreWindow: (id) => {
    zCounter += 1;
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, minimized: false, zIndex: zCounter } : w
      ),
    }));
  },

  toggleMaximize: (id) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, maximized: !w.maximized } : w
      ),
    })),

  updatePosition: (id, x, y) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  updateSize: (id, width, height) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, width, height } : w
      ),
    })),

  // Lets an app update its own window title after the fact — e.g. Write
  // renaming the titlebar to the actual filename once a document is saved.
  setWindowTitle: (id, title) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, title } : w)),
    })),

  getMinimizedWindows: () => get().windows.filter((w) => w.minimized),
  isWindowOpen: (id) => get().windows.some((w) => w.id === id),
}));