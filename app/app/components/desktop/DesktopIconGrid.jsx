"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { RotateCcw, Info, FolderOpen, Grid3x3, RefreshCw, Settings as SettingsIcon, Check } from "lucide-react";
import { useWindowStore, useSettingsStore } from "@/app/stores";
import { useAllApps } from "@/app/lib/appRegistry";
import { useContextMenu } from "@/app/components/common/ContextMenu";

const ICON_SIZE_MAP = {
  small: { cell: 92, tile: 46, icon: 21, text: "10.5px" },
  medium: { cell: 108, tile: 58, icon: 26, text: "11.5px" },
  large: { cell: 128, tile: 70, icon: 32, text: "12.5px" },
};

const TASKBAR_CLEARANCE = 76; // keep icons from landing under the taskbar
const TOP_CLEARANCE = 8;
const SIDE_CLEARANCE = 8;

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

// Default column-flow layout (top-to-bottom, then wrap to next column) —
// exactly how the old flex-wrap version read icons, kept as the fallback
// grid so anything not yet manually moved still lands somewhere sane.
function defaultGridPositions(appIds, cell) {
  const cols = Math.max(1, Math.floor((window.innerHeight - TOP_CLEARANCE - TASKBAR_CLEARANCE) / cell));
  const positions = {};
  appIds.forEach((id, i) => {
    const col = Math.floor(i / cols);
    const row = i % cols;
    positions[id] = {
      x: SIDE_CLEARANCE + col * cell,
      y: TOP_CLEARANCE + row * cell,
    };
  });
  return positions;
}

function clampToViewport(x, y, cell) {
  const maxX = Math.max(SIDE_CLEARANCE, window.innerWidth - cell - SIDE_CLEARANCE);
  const maxY = Math.max(TOP_CLEARANCE, window.innerHeight - cell - TASKBAR_CLEARANCE);
  return {
    x: Math.min(Math.max(x, SIDE_CLEARANCE), maxX),
    y: Math.min(Math.max(y, TOP_CLEARANCE), maxY),
  };
}

const STORAGE_KEY = "desktop:iconPositions:v1";

function loadStoredPositions() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePositions(positions) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export default function DesktopIconGrid() {
  const [selectedId, setSelectedId] = useState(null);
  const [positions, setPositions] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const openWindow = useWindowStore((s) => s.openWindow);
  const iconSize = useSettingsStore((s) => s.iconSize);
  const setIconSize = useSettingsStore((s) => s.setIconSize);
  const { openMenu } = useContextMenu();

  const desktopApps = useAllApps().filter((a) => a.showOnDesktop);
  const size = ICON_SIZE_MAP[iconSize] ?? ICON_SIZE_MAP.medium;

  const dragState = useRef({ id: null, offsetX: 0, offsetY: 0, moved: false });
  const gridRef = useRef(null);

  // Hydrate positions once on mount, filling in a sane default grid slot
  // for any app that doesn't have a saved position yet (new installs,
  // freshly-connected integrations, etc.) without disturbing icons the
  // person has already dragged.
  useEffect(() => {
    const stored = loadStoredPositions();
    const fallback = defaultGridPositions(desktopApps.map((a) => a.id), size.cell);
    const merged = {};
    desktopApps.forEach((app) => {
      merged[app.id] = stored[app.id] ?? fallback[app.id];
    });
    setPositions(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktopApps.map((a) => a.id).join(","), iconSize]);

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

  const commitPositions = useCallback((next) => {
    setPositions(next);
    savePositions(next);
  }, []);

  // ── dragging (mac-Finder style: free placement, clamped to viewport) ──
  const handlePointerDown = (e, app) => {
    e.stopPropagation();
    setSelectedId(app.id);
    const pos = positions[app.id];
    if (!pos) return;
    dragState.current = {
      id: app.id,
      offsetX: e.clientX - pos.x,
      offsetY: e.clientY - pos.y,
      moved: false,
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const handlePointerMove = (e) => {
    const { id, offsetX, offsetY } = dragState.current;
    if (!id) return;
    dragState.current.moved = true;
    setDraggingId(id);
    const { x, y } = clampToViewport(e.clientX - offsetX, e.clientY - offsetY, size.cell);
    setPositions((prev) => ({ ...prev, [id]: { x, y } }));
  };

  const handlePointerUp = () => {
    const { id, moved } = dragState.current;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    setDraggingId(null);
    if (id && moved) {
      setPositions((prev) => {
        savePositions(prev);
        return prev;
      });
    }
    dragState.current = { id: null, offsetX: 0, offsetY: 0, moved: false };
  };

  const handleDeselect = (e) => {
    if (e.target === e.currentTarget) setSelectedId(null);
  };

  // ── right-click: empty desktop ──────────────────────────────────────
  const handleDesktopContextMenu = (e) => {
    if (e.target !== e.currentTarget) return; // let icon's own handler take it
    openMenu(e, [
      {
        label: "Sort icons",
        icon: Grid3x3,
        onClick: () => commitPositions(defaultGridPositions(desktopApps.map((a) => a.id), size.cell)),
      },
      { divider: true },
      {
        label: "Small icons",
        icon: iconSize === "small" ? Check : undefined,
        onClick: () => setIconSize("small"),
      },
      {
        label: "Medium icons",
        icon: iconSize === "medium" ? Check : undefined,
        onClick: () => setIconSize("medium"),
      },
      {
        label: "Large icons",
        icon: iconSize === "large" ? Check : undefined,
        onClick: () => setIconSize("large"),
      },
      { divider: true },
      { label: "Refresh desktop", icon: RefreshCw, onClick: () => window.location.reload() },
      {
        label: "Open Settings",
        icon: SettingsIcon,
        onClick: () => {
          const app = desktopApps.find((a) => a.id === "settings");
          if (app) handleLaunch(app);
        },
      },
    ]);
  };

  // ── right-click: a specific icon ────────────────────────────────────
  const handleIconContextMenu = (e, app) => {
    setSelectedId(app.id);
    openMenu(e, [
      { label: "Open", icon: FolderOpen, onClick: () => handleLaunch(app), disabled: app.comingSoon },
      {
        label: "Reset position",
        icon: RotateCcw,
        onClick: () => {
          const fallback = defaultGridPositions(desktopApps.map((a) => a.id), size.cell);
          commitPositions({ ...positions, [app.id]: fallback[app.id] });
        },
      },
      { divider: true },
      {
        label: "Get info",
        icon: Info,
        onClick: () => {
          window.alert(
            `${app.title}${app.comingSoon ? " (coming soon)" : ""}\n${app.isWebApp ? "Web integration" : "Built-in Campus app"}`
          );
        },
      },
    ]);
  };

  return (
    <div
      ref={gridRef}
      onPointerDown={handleDeselect}
      onContextMenu={handleDesktopContextMenu}
      className="fixed inset-0 z-0"
    >
      {desktopApps.map((app) => {
        const isSelected = selectedId === app.id;
        const isDragging = draggingId === app.id;
        const Icon = app.icon;
        const color = app.color ?? "#6B7280";
        const pos = positions[app.id];
        if (!pos) return null;

        return (
          <button
            key={app.id}
            onPointerDown={(e) => handlePointerDown(e, app)}
            onDoubleClick={() => handleLaunch(app)}
            onContextMenu={(e) => handleIconContextMenu(e, app)}
            title={app.comingSoon ? `${app.title} — coming soon` : app.title}
            style={{
              width: size.cell,
              height: size.cell,
              position: "absolute",
              left: pos.x,
              top: pos.y,
              touchAction: "none",
              zIndex: isDragging ? 20 : 1,
            }}
            className={`group flex select-none flex-col items-center justify-start gap-2 rounded-2xl p-2.5
                        outline-none transition-[transform,box-shadow] duration-200 ease-out
                        ${isDragging ? "scale-105 cursor-grabbing shadow-2xl" : "cursor-default"}
                        ${isSelected && !isDragging ? "scale-[0.98]" : ""}
                        ${!isDragging && !isSelected ? "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]" : ""}
                        ${app.comingSoon ? "opacity-60" : ""}`}
          >
            {/* selection / hover backdrop — glassy, not a flat tint */}
            <span
              className={`pointer-events-none absolute inset-0 rounded-2xl border transition-all duration-200
                          ${isSelected || isDragging
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
                boxShadow: isSelected || isDragging
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
                         ${isSelected || isDragging ? "opacity-100" : "opacity-95 group-hover:opacity-100"}`}
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