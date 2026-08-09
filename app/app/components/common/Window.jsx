"use client";

import { useRef, useCallback } from "react";
import { X, Minus, Square, Copy } from "lucide-react";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";

export default function Window({
  title, x, y, width, height, minWidth, minHeight, zIndex, maximized,
  children, onClose, onFocus, onMinimize, onToggleMaximize, onDrag, onResize,
}) {
  const dragState = useRef(null);
  const resizeState = useRef(null);

  const handleDragMove = useCallback((e) => {
    if (!dragState.current) return;
    const { startX, startY, originX, originY } = dragState.current;
    onDrag(Math.max(0, originX + (e.clientX - startX)), Math.max(0, originY + (e.clientY - startY)));
  }, [onDrag]);

  const handleDragUp = useCallback(() => {
    dragState.current = null;
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragUp);
  }, [handleDragMove]);

  const handleDragDown = useCallback((e) => {
    onFocus();
    if (maximized) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: x, originY: y };
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
    window.removeEventListener("pointermove", handleResizeMove);
    window.removeEventListener("pointerup", handleResizeUp);
  }, [handleResizeMove]);

  const handleResizeDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    onFocus();
    resizeState.current = { startX: e.clientX, startY: e.clientY, originW: width, originH: height };
    window.addEventListener("pointermove", handleResizeMove);
    window.addEventListener("pointerup", handleResizeUp);
  }, [width, height, onFocus, handleResizeMove, handleResizeUp]);

  return (
    <div
      onPointerDown={onFocus}
      style={{
        fontFamily:
          '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif',
        touchAction: "none",
        ...(maximized
          ? { top: 0, left: 0, right: 0, bottom: TASKBAR_HEIGHT, zIndex }
          : { top: y, left: x, width, height, minWidth, minHeight, zIndex }),
      }}
      className="fixed flex flex-col overflow-hidden rounded-xl
                 border border-border
                 bg-background-elevated backdrop-blur-2xl backdrop-saturate-150
                 shadow-[0_14px_40px_rgba(0,0,0,0.20)] dark:shadow-[0_14px_40px_rgba(0,0,0,0.55)]"
    >
      <div
        onPointerDown={handleDragDown}
        onDoubleClick={onToggleMaximize}
        className="flex h-9 shrink-0 cursor-grab items-center justify-between
                   pl-3.5 pr-1.5 active:cursor-grabbing select-none"
      >
        <span className="truncate text-[12.5px] font-medium text-foreground">
          {title}
        </span>

        <div className="flex h-full items-center gap-0.5">
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onMinimize}
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-foreground-secondary hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]
                       active:bg-black/[0.09] dark:active:bg-white/[0.12]"
          >
            <Minus size={13} strokeWidth={1.75} />
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-foreground-secondary hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]
                       active:bg-black/[0.09] dark:active:bg-white/[0.12]"
          >
            {maximized ? <Copy size={11} strokeWidth={1.75} /> : <Square size={10} strokeWidth={1.75} />}
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md
                       text-foreground-secondary hover:bg-red-500 hover:text-white active:bg-red-600"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="h-px shrink-0 bg-border" />

      <div className="flex-1 overflow-auto bg-background-secondary/40 dark:bg-black/20 text-foreground">
        {children}
      </div>

      {!maximized && (
        <div
          onPointerDown={handleResizeDown}
          style={{ touchAction: "none" }}
          className="absolute bottom-0.5 right-0.5 z-10 h-5 w-5 cursor-nwse-resize select-none"
        >
          <svg viewBox="0 0 16 16" className="h-full w-full opacity-40 pointer-events-none">
            <path d="M14 2 L2 14 M14 8 L8 14 M14 14 L14 14" stroke="var(--foreground)" strokeWidth="1.2" />
          </svg>
        </div>
      )}
    </div>
  );
}