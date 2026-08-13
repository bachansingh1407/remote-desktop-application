"use client";

import { useRef, useCallback, useState } from "react";
import { X, Minus, Square, Copy } from "lucide-react";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { getApp } from "@/app/lib/appRegistry";

export default function Window({
  id, title, x, y, width, height, minWidth, minHeight, zIndex, maximized, isFocused = true,
  exiting = null, // "close" | "minimize" | null — drives the exit animation
  children, onClose, onFocus, onMinimize, onToggleMaximize, onDrag, onResize,
}) {
  const dragState = useRef(null);
  const resizeState = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);



  // Same registry lookup Taskbar uses for its icons — gives every window a
  // little identity badge instead of a bare text title. File/viewer windows
  // (id like "file-<id>") won't match, so they just show the title, same
  // as they do on the taskbar.
  const app = getApp(id);
  const AppIcon = app?.icon;
  const appColor = app?.color ?? "var(--color-accent)";
  // Flat tinted chip — matches the file/folder icon language used throughout
  // the app now, instead of the old glossy gradient badge.
  const appIconStyle = {
    background: `color-mix(in srgb, ${appColor} 16%, var(--background-secondary))`,
    color: appColor,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${appColor} 24%, transparent)`,
  };

  const handleDragMove = useCallback((e) => {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    onDrag(Math.max(0, originX + (e.clientX - startX)), Math.max(0, originY + (e.clientY - startY)));
  }, [onDrag]);

  const handleDragUp = useCallback(() => {
    dragState.current = null;
    setIsDragging(false);
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragUp);
  }, [handleDragMove]);

  const handleDragDown = useCallback((e) => {
    onFocus();
    if (maximized) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: x, originY: y };
    setIsDragging(true);
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragUp);
  }, [x, y, maximized, onFocus, handleDragMove, handleDragUp]);

  const handleResizeMove = useCallback((e) => {
    if (!resizeState.current) return;
    const { startX, startY, originW, originH } = resizeState.current;
    const nextWidth = Math.max(minWidth ?? 240, originW + (e.clientX - startX));
    const nextHeight = Math.max(minHeight ?? 160, originH + (e.clientY - startY));
    onResize(nextWidth, nextHeight);
  }, [minWidth, minHeight, onResize]);

  const handleResizeUp = useCallback(() => {
    resizeState.current = null;
    setIsResizing(false);
    window.removeEventListener("pointermove", handleResizeMove);
    window.removeEventListener("pointerup", handleResizeUp);
  }, [handleResizeMove]);

  const handleResizeDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onFocus();
    resizeState.current = { startX: e.clientX, startY: e.clientY, originW: width, originH: height };
    setIsResizing(true);
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", handleResizeUp);
  }, [width, height, onFocus, handleResizeMove, handleResizeUp]);

  const lifted = isDragging || isResizing;


  // Mac-style open/close/minimize: mount plays a pop-in, closing plays a
  // quick fade+settle, minimizing shrinks down toward the taskbar. All three
  // are pure transform+opacity keyframes (see globals.css) — no JS driving
  // the motion, so it stays cheap with several windows animating at once.
  const exitAnim =
    exiting === "close"
      ? "animate-window-out-close"
      : exiting === "minimize"
        ? "animate-window-out-minimize"
        : "animate-window-in";

  return (
    <div
      onPointerDown={exiting ? undefined : onFocus}
      style={{
        touchAction: "none",
        ...(maximized
          ? { top: 0, left: 0, right: 0, bottom: TASKBAR_HEIGHT, zIndex }
          : { top: y, left: x, width, height, minWidth, minHeight, zIndex }),
      }}
      className={`${exitAnim} fixed flex flex-col overflow-hidden rounded-md
                 border bg-background-elevated backdrop-blur-2xl backdrop-saturate-150
                 transition-shadow duration-200 ease-out
                 ${exiting ? "pointer-events-none" : ""}
                 ${lifted
          ? "border-border shadow-[0_26px_64px_rgba(0,0,0,0.34)] dark:shadow-[0_26px_64px_rgba(0,0,0,0.72)]"
          : isFocused
            ? "border-border shadow-[0_18px_48px_rgba(0,0,0,0.24)] dark:shadow-[0_18px_48px_rgba(0,0,0,0.6)]"
            : "border-border/60 shadow-[0_8px_22px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_22px_rgba(0,0,0,0.4)]"}`}
    >
      <div
        onPointerDown={handleDragDown}
        onDoubleClick={onToggleMaximize}
        className="relative flex h-10 shrink-0 cursor-grab items-center justify-between
                   pl-2.5 pr-1.5 active:cursor-grabbing select-none"
      >
        <div className={`flex min-w-0 items-center gap-2 transition-opacity duration-200 ${isFocused ? "opacity-100" : "opacity-50"}`}>
          {AppIcon && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
              style={appIconStyle}
            >
              <AppIcon size={11} strokeWidth={2.1} />
            </span>
          )}
          <span className="truncate text-[12.5px] font-medium text-foreground">
            {title}
          </span>
        </div>

        <div className="flex h-full items-center gap-0.5">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
            title="Minimize"
            className="flex h-6 w-6 items-center justify-center rounded-sm
                       text-foreground-secondary transition-all duration-100
                       hover:bg-foreground/[0.08] hover:text-foreground active:scale-90"
          >
            <Minus size={13} strokeWidth={1.9} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
            title={maximized ? "Restore" : "Maximize"}
            className="flex h-6 w-6 items-center justify-center rounded-sm
                       text-foreground-secondary transition-all duration-100
                       hover:bg-foreground/[0.08] hover:text-foreground active:scale-90"
          >
            {maximized ? <Copy size={11} strokeWidth={1.9} /> : <Square size={10} strokeWidth={1.9} />}
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            title="Close"
            className="flex h-6 w-6 items-center justify-center rounded-sm
                       text-foreground-secondary transition-all duration-100
                       hover:bg-red-500 hover:text-white active:scale-90 active:bg-red-600"
          >
            <X size={13} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className={`h-px shrink-0 transition-colors duration-200 ${isFocused ? "bg-border" : "bg-border/50"}`} />

      <div className="flex-1 overflow-auto bg-background-secondary/50 text-foreground">
        {children}
      </div>

      {!maximized && (
        <div
          onPointerDown={handleResizeDown}
          style={{ touchAction: "none" }}
          className="group absolute bottom-0 right-0 z-10 h-6 w-6 cursor-nwse-resize select-none"
        >
          <svg viewBox="0 0 16 16" className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 opacity-30 transition-opacity duration-150 group-hover:opacity-70">
            <circle cx="13" cy="13" r="1.1" fill="var(--foreground)" />
            <circle cx="9" cy="13" r="1.1" fill="var(--foreground)" />
            <circle cx="13" cy="9" r="1.1" fill="var(--foreground)" />
          </svg>
        </div>
      )}
    </div>
  );
}