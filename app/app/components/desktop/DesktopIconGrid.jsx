"use client";

import { useState, useCallback } from "react";
import { useWindowStore, useSettingsStore } from "@/app/stores";
import { useAllApps } from "@/app/lib/appRegistry";

const ICON_SIZE_MAP = {
  small: { cell: 92, tile: 46, icon: 21, text: "10.5px" },
  medium: { cell: 108, tile: 58, icon: 26, text: "11.5px" },
  large: { cell: 128, tile: 70, icon: 32, text: "12.5px" },
};

// Soft, per-app halo colour behind the tile — same accent, low opacity,
// so hovering/opening a coloured icon feels like it's genuinely "lit up"
// rather than just brightening a flat square.
function withAlpha(hex, alpha) {
  if (!hex) return `rgba(107,114,128,${alpha})`;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function DesktopIconGrid() {
  const [selectedId, setSelectedId] = useState(null);
  const openWindow = useWindowStore((s) => s.openWindow);
  const iconSize = useSettingsStore((s) => s.iconSize);

  const desktopApps = useAllApps().filter((a) => a.showOnDesktop);
  const size = ICON_SIZE_MAP[iconSize] ?? ICON_SIZE_MAP.medium;

  const handleLaunch = useCallback(
    (app) => {
      if (app.comingSoon || !app.component) return;
      openWindow({
        id: app.id,
        title: app.title,
        content: <app.component />,
        width: app.width,
        height: app.height,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
      });
    },
    [openWindow]
  );

  const handleDeselect = (e) => {
    if (e.target === e.currentTarget) setSelectedId(null);
  };

  return (
    <div
      onPointerDown={handleDeselect}
      className="fixed inset-0 z-0 flex flex-col flex-wrap content-start items-start gap-0.5 p-4"
    >
      {desktopApps.map((app) => {
        const isSelected = selectedId === app.id;
        const Icon = app.icon;
        const color = app.color ?? "#6B7280";

        return (
          <button
            key={app.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              setSelectedId(app.id);
            }}
            onDoubleClick={() => handleLaunch(app)}
            title={app.comingSoon ? `${app.title} — coming soon` : app.title}
            style={{ width: size.cell, height: size.cell }}
            className={`group relative flex select-none flex-col items-center justify-start gap-2 rounded-2xl p-2.5
                        outline-none transition-all duration-200 ease-out
                        ${isSelected ? "scale-[0.98]" : "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"}
                        ${app.comingSoon ? "opacity-60" : ""}`}
          >
            {/* selection / hover backdrop — glassy, not a flat tint */}
            <span
              className={`pointer-events-none absolute inset-0 rounded-2xl border transition-all duration-200
                          ${isSelected
                  ? "border-white/25 bg-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md"
                  : "border-transparent bg-white/0 group-hover:border-white/15 group-hover:bg-white/10 group-hover:backdrop-blur-md"
                }`}
            />

            {/* icon tile */}
            <div
              style={{
                width: size.tile,
                height: size.tile,
                background: `linear-gradient(155deg, ${withAlpha(color, 1)} 0%, ${withAlpha(color, 0.78)} 100%)`,
                boxShadow: isSelected
                  ? `0 10px 26px -4px ${withAlpha(color, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.25)`
                  : `0 6px 16px -4px ${withAlpha(color, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
              className="relative z-10 flex shrink-0 items-center justify-center rounded-[10px]
                         ring-1 ring-white/15 transition-transform duration-200 ease-out
                         group-hover:scale-[1.07] group-active:scale-[0.96]"
            >
              {/* glossy top highlight */}
              <span className="pointer-events-none absolute inset-x-1 top-1 h-1/3 rounded-full bg-white/25 blur-[3px]" />
              <Icon
                size={size.icon}
                className="relative text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
                strokeWidth={1.9}
              />
            </div>

            {/* label */}
            <span
              style={{ fontSize: size.text }}
              className={`relative z-10 line-clamp-2 w-full text-center font-medium leading-tight text-white
                         transition-all duration-150
                         [text-shadow:0_1px_4px_rgba(0,0,0,0.85)]
                         ${isSelected ? "opacity-100" : "opacity-95 group-hover:opacity-100"}`}
            >
              {app.title}
            </span>

            {app.comingSoon && (
              <span
                className="relative z-10 rounded-full bg-black/40 px-1.5 py-0.5 text-[8.5px] font-semibold
                           uppercase tracking-wide text-white/80 backdrop-blur-sm"
              >
                Soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}