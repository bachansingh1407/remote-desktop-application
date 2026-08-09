import { create } from "zustand";
import { persist } from "zustand/middleware";

const applyThemeClass = (theme) => {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
};

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: "light", // "dark" | "light" — default light

      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },

      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        applyThemeClass(next);
        set({ theme: next });
      },

      initializeTheme: () => {
        const stored = get().theme;
        const theme = stored || "light";
        applyThemeClass(theme);
        set({ theme });
      },
    }),
    {
      name: "theme-storage",
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);