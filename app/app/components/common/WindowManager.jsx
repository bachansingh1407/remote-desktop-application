"use client";

import { useWindowStore } from "@/app/stores";
import Window from "./Window";

export default function WindowManager() {
  const windows = useWindowStore((state) => state.windows);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const minimizeWindow = useWindowStore((state) => state.minimizeWindow);
  const toggleMaximize = useWindowStore((state) => state.toggleMaximize);
  const updatePosition = useWindowStore((state) => state.updatePosition);
  const updateSize = useWindowStore((state) => state.updateSize);

  const visibleWindows = windows.filter((w) => !w.minimized);

  return (
    <>
      {visibleWindows.map((w) => (
        <Window
          key={w.id}
          {...w}
          onClose={() => closeWindow(w.id)}
          onFocus={() => focusWindow(w.id)}
          onMinimize={() => minimizeWindow(w.id)}
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