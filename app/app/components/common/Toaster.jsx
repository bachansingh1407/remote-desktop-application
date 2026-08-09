"use client";

import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "@/app/stores/useToastStore";

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  default: Info,
};

const ACCENTS = {
  success: "text-emerald-500",
  error: "text-red-500",
  default: "text-accent",
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-16 right-4 z-[10002] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant] ?? ICONS.default;
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border
                       bg-background-elevated p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]
                       backdrop-blur-2xl backdrop-saturate-150 animate-[toast-in_0.18s_ease-out]"
          >
            <Icon size={16} className={`mt-0.5 shrink-0 ${ACCENTS[t.variant] ?? ACCENTS.default}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-foreground">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[11px] leading-snug text-foreground-secondary">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-foreground-secondary/60 hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
