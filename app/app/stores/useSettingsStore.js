import { create } from "zustand";
import { persist } from "zustand/middleware";

const applyAccentColor = (color) => {
  if (typeof window === "undefined") return;
  document.documentElement.style.setProperty("--accent", color);
};

export const ACCENT_PRESETS = [
  { id: "violet", label: "Violet", value: "#7c3aed" },
  { id: "cyan", label: "Cyan", value: "#0891b2" },
  { id: "rose", label: "Rose", value: "#e11d48" },
  { id: "amber", label: "Amber", value: "#d97706" },
  { id: "emerald", label: "Emerald", value: "#16a34a" },
];

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ── appearance ──
      accentColor: ACCENT_PRESETS[0].value,
      // `wallpaper` is either a preset id (see lib/wallpapers.js) or the
      // literal string "custom", in which case `customWallpaper` (a
      // compressed data URL) is what actually renders. Kept as two fields
      // so switching back to a preset doesn't throw away the user's last
      // uploaded image — they can toggle back to "custom" without
      // re-importing it.
      wallpaper: "default",
      customWallpaper: null,
      iconSize: "medium",
      taskbarPosition: "bottom",
      reduceMotion: false,

      // ── files ──
      defaultView: "grid", // "grid" | "list"
      confirmBeforeDelete: true,

      // ── system ──
      soundEnabled: true,
      notificationsEnabled: true,
      animationsEnabled: true,

      isInitialized: false,

      // ── setters ──
      setAccentColor: (accentColor) => {
        applyAccentColor(accentColor);
        set({ accentColor });
      },
      setWallpaper: (wallpaper) => set({ wallpaper }),
      // Stores the processed custom image AND switches to it in one call —
      // used by the upload flow in Settings. Kept separate from
      // `setWallpaper` so picking a preset never has to touch this field.
      setCustomWallpaper: (dataUrl) => set({ customWallpaper: dataUrl, wallpaper: "custom" }),
      clearCustomWallpaper: () =>
        set((s) => ({
          customWallpaper: null,
          wallpaper: s.wallpaper === "custom" ? "default" : s.wallpaper,
        })),
      setIconSize: (iconSize) => set({ iconSize }),
      setTaskbarPosition: (taskbarPosition) => set({ taskbarPosition }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),

      setDefaultView: (defaultView) => set({ defaultView }),
      setConfirmBeforeDelete: (confirmBeforeDelete) =>
        set({ confirmBeforeDelete }),

      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleNotifications: () =>
        set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),
      toggleAnimations: () =>
        set((s) => ({ animationsEnabled: !s.animationsEnabled })),

      resetSettings: () => {
        applyAccentColor(ACCENT_PRESETS[0].value);
        set({
          accentColor: ACCENT_PRESETS[0].value,
          wallpaper: "default",
          customWallpaper: null,
          iconSize: "medium",
          taskbarPosition: "bottom",
          reduceMotion: false,
          defaultView: "grid",
          confirmBeforeDelete: true,
          soundEnabled: true,
          notificationsEnabled: true,
          animationsEnabled: true,
        });
      },

      initializeSettings: () => {
        applyAccentColor(get().accentColor);
        set({ isInitialized: true });
      },
    }),
    {
      name: "settings-storage",
      partialize: (state) => ({
        accentColor: state.accentColor,
        wallpaper: state.wallpaper,
        customWallpaper: state.customWallpaper,
        iconSize: state.iconSize,
        taskbarPosition: state.taskbarPosition,
        reduceMotion: state.reduceMotion,
        defaultView: state.defaultView,
        confirmBeforeDelete: state.confirmBeforeDelete,
        soundEnabled: state.soundEnabled,
        notificationsEnabled: state.notificationsEnabled,
        animationsEnabled: state.animationsEnabled,
      }),
    }
  )
);