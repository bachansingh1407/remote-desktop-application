"use client";

import { useSettingsStore } from "@/app/stores";
import { getWallpaperCss } from "@/app/lib/wallpapers";

// Renders behind everything else on the desktop. Reads wallpaper state from
// useSettingsStore (persisted to localStorage), so a choice made here
// survives reloads without the user ever re-importing an image — switching
// between "custom" and a preset just toggles which of these two fields wins.
export default function WallpaperLayer() {
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const customWallpaper = useSettingsStore((s) => s.customWallpaper);

  const isCustom = wallpaper === "custom" && customWallpaper;

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 bg-cover bg-center transition-[background] duration-300"
      style={
        isCustom
          ? { backgroundImage: `url(${customWallpaper})` }
          : { backgroundImage: getWallpaperCss(wallpaper) }
      }
    >
      {/* subtle vignette so desktop icon text stays legible on any wallpaper */}
      <div className="absolute inset-0 bg-black/10" />
    </div>
  );
}
