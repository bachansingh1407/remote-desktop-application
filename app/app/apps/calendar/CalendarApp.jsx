"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export default function CalendarApp() {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const today = new Date();
  const todayKey = formatDateKey(today);
  const selectedKey = formatDateKey(selectedDate);

  const weeks = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const rows = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [viewDate]);

  const changeMonth = (delta) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  const goToday = () => {
    const now = new Date();
    setViewDate(now);
    setSelectedDate(now);
  };

  return (
    <div className="flex h-full flex-col gap-3 bg-background p-3 text-foreground">
      {/* header */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} className="text-accent" />
          <span className="text-xs font-medium">
            {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => changeMonth(-1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={goToday}
            className="rounded-md px-1.5 py-0.5 text-[10px] text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
          >
            Today
          </button>
          <button
            onClick={() => changeMonth(1)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* day labels */}
      <div className="grid shrink-0 grid-cols-7 text-center text-[10px] text-foreground-secondary/70">
        {DAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* week rows */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((date, i) => {
              const dateKey = formatDateKey(date);
              const inMonth = date.getMonth() === viewDate.getMonth();
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedKey;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={`flex h-9 items-center justify-center rounded-md text-xs transition-colors
                    ${
                      !inMonth
                        ? "text-foreground-secondary/30"
                        : isToday
                        ? "bg-accent font-semibold text-white"
                        : isSelected
                        ? "bg-accent/15 text-accent"
                        : "text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                    }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-border pt-2 text-[10px] text-foreground-secondary">
        {selectedDate.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </div>
    </div>
  );
}