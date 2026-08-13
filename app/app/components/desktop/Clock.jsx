"use client";

import { useState, useEffect } from "react";
import { useWindowStore } from "@/app/stores";
import { getApp } from "@/app/lib/appRegistry";

// Ticks once a minute, aligned to the minute boundary — same pattern as
// LoginPage's clock, so the taskbar and the lock screen never feel like
// two different products.
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId;
    const scheduleNext = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNext();
      }, msToNextMinute);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return now;
}

// Clicking opens Calendar — a real system clock always doubles as a
// shortcut into the calendar app, so this one does too.
export default function Clock() {
  const now = useLiveClock();
  const openWindow = useWindowStore((s) => s.openWindow);

  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const handleClick = () => {
    const app = getApp("calendar");
    if (!app) return;
    openWindow({
      id: app.id,
      title: app.title,
      content: <app.component />,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
    });
  };

  return (
    <button
      onClick={handleClick}
      title={now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      className="flex flex-col items-end justify-center rounded-lg px-2.5 py-1
                 leading-tight text-foreground transition-colors
                 hover:bg-black/[0.06] active:bg-black/[0.09]
                 dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]"
    >
      <span className="text-[12.5px] font-medium tabular-nums">{time}</span>
      <span className="text-[10px] text-foreground-secondary">{date}</span>
    </button>
  );
}