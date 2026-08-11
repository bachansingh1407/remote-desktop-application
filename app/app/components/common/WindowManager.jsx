"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useWindowStore } from "@/app/stores";
import Window from "./Window";

// Must match the durations of .animate-window-out-close /
// .animate-window-out-minimize in globals.css.
const CLOSE_DURATION = 170;
const MINIMIZE_DURATION = 230;

export default function WindowManager() {
  const windows = useWindowStore((state) => state.windows);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const updatePosition = useWindowStore((state) => state.updatePosition);
  const updateSize = useWindowStore((state) => state.updateSize);

  // Windows mid close/minimize animation stay mounted (and thus visible)
  // for exactly as long as their CSS animation takes, then the real store
  // mutation fires. No JS animation loop, no measuring — just a timer that
  // mirrors the CSS duration, so cost is one setTimeout per action.
  const [exiting, setExiting] = useState({}); // id -> "close" | "minimize"
  const timers = useRef({});

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      Object.values(activeTimers).forEach(clearTimeout);
    };
  }, []);

  const runExit = useCallback((id, type, duration, commit) => {
    setExiting((prev) => ({ ...prev, [id]: type }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      commit(id);
      setExiting((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete timers.current[id];
    }, duration);
  }, []);

  const handleClose = useCallback(
    (id) => runExit(id, "close", CLOSE_DURATION, closeWindow),
    [runExit, closeWindow]
  );
  const handleMinimize = useCallback(
    (id) => runExit(id, "minimize", MINIMIZE_DURATION, minimizeWindow),
    [runExit, minimizeWindow]
  );

  // Visible = not minimized in the store, OR still mid-exit animation (so a
  // minimizing window keeps rendering just long enough to finish shrinking
  // away instead of popping out of existence).
  const visibleWindows = windows.filter((w) => !w.minimized || exiting[w.id]);
  const topZIndex =
    visibleWindows.length > 0 ? Math.max(...visibleWindows.map((w) => w.zIndex)) : -1;

  return (
    <>
      {visibleWindows.map((w) => (
        <Window
          key={w.id}
          {...w}
          isFocused={w.zIndex === topZIndex && !exiting[w.id]}
          exiting={exiting[w.id] ?? null}
          onClose={() => handleClose(w.id)}
          onFocus={() => focusWindow(w.id)}
          onMinimize={() => handleMinimize(w.id)}
          onToggleMaximize={() => toggleMaximize(w.id)}
          onDrag={(x, y) => updatePosition(w.id, x, y)}
          onResize={(width, height) => updateSize(w.id, width, height)}
        >
          {w.content}
        </Window>
      ))}
    </>
  );
}