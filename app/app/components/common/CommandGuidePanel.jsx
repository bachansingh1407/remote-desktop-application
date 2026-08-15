"use client";

import { X } from "lucide-react";

/**
 * A right-side slide-over listing what an app's command surface can do,
 * grouped into sections. Used by both Steve's Operations tab and Tool
 * Console — same shape, different content, so people always know what to
 * type instead of guessing.
 *
 * sections: [{ title, items: [{ example, description }] }]
 */
export default function CommandGuidePanel({ open, onClose, title, subtitle, sections, onPick }) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex justify-end bg-black/25 backdrop-blur-[1px] animate-fade-in"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-full w-72 flex-col border-l border-border bg-background-elevated shadow-[-16px_0_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl backdrop-saturate-150">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">{title}</p>
            {subtitle && <p className="mt-0.5 text-[10.5px] text-foreground-secondary">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md p-1 text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]">
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {sections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-secondary/60">
                {section.title}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <button
                    key={item.example}
                    onClick={() => onPick?.(item.example)}
                    className="group rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                  >
                    <p className="font-mono text-[11px] text-accent">{item.example}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-foreground-secondary">{item.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
