"use client";

import { useState, useCallback } from "react";
import { useWindowStore, useSettingsStore } from "@/app/stores";
import { APP_REGISTRY } from "@/app/lib/appRegistry";

const ICON_SIZE_MAP = {
  small: { cell: 88, tile: 44, icon: 20, text: "10px" },
  medium: { cell: 104, tile: 54, icon: 24, text: "11px" },
  large: { cell: 124, tile: 66, icon: 30, text: "12px" },
};

export default function DesktopIconGrid() {
  const [selectedId, setSelectedId] = useState(null);
  const openWindow = useWindowStore((s) => s.openWindow);
  const iconSize = useSettingsStore((s) => s.iconSize);

  const desktopApps = APP_REGISTRY.filter((a) => a.showOnDesktop);
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
      className="fixed inset-0 z-0 flex flex-col flex-wrap content-start items-start p-3"
    >
      {desktopApps.map((app) => {
        const isSelected = selectedId === app.id;
        const Icon = app.icon;
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
            className={`group flex select-none flex-col items-center justify-start gap-1.5 rounded-lg p-2
                        outline-none transition-colors duration-150
                        ${
                          isSelected
                            ? "bg-white/25 ring-1 ring-white/50"
                            : "hover:bg-white/10 active:bg-white/20"
                        }
                        ${app.comingSoon ? "opacity-70" : ""}`}
          >
            <div
              style={{
                width: size.tile,
                height: size.tile,
                backgroundColor: app.color ?? "#6B7280",
              }}
              className="flex shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-black/20
                         ring-1 ring-white/10 transition-transform duration-150 group-hover:scale-105"
            >
              <Icon size={size.icon} className="text-white" strokeWidth={2} />
            </div>
            <span
              style={{ fontSize: size.text }}
              className="line-clamp-2 w-full text-center font-medium leading-tight text-white
                         [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]"
            >
              {app.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}