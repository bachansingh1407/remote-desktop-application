"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Megaphone,
  Code2,
  Terminal,
  Trash2,
  MessageCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { useWindowStore, useAuthStore } from "@/app/stores";
import { useSteveStore } from "@/app/stores/useSteveStore";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { getApp } from "@/app/lib/appRegistry";
import { SteveAvatar } from "@/app/apps/steve/SteveApp";

// Quick-launch shortcuts in Steve's dock. Each maps to a real app id in the
// registry — clicking one opens that app's actual window, same as the
// taskbar would. Kept short and purposeful rather than mirroring every app.
const DOCK_ITEMS = [
  { appId: "files", label: "Files", icon: FolderOpen },
  { appId: "community", label: "Community", icon: Megaphone },
  { appId: "snippets", label: "Snippets", icon: Code2 },
  { appId: "tool-console", label: "Console", icon: Terminal },
  { appId: "trash", label: "Trash", icon: Trash2 },
];

const LAST_SEEN_KEY = "steve:lastSeenAt";

// Picks a contextual opening line based on how long it's been since the
// person last had Campus open, computed once per mount from a plain
// localStorage timestamp — deliberately not tied to any backend state.
function buildGreeting(firstName, hasMetSteve) {
  if (typeof window === "undefined") return `Hey ${firstName}.`;

  const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY);
  const now = Date.now();
  localStorage.setItem(LAST_SEEN_KEY, String(now));

  if (!lastSeenRaw) {
    return hasMetSteve ? `Hey ${firstName}, good to see you.` : `Hey ${firstName} — I'm Steve. Open me up, I'll show you around.`;
  }

  const diffMs = now - Number(lastSeenRaw);
  const hours = diffMs / (1000 * 60 * 60);

  if (hours < 0.05) return `Back already, ${firstName}?`;
  if (hours < 6) return `Welcome back, ${firstName}.`;
  if (hours < 24) return `Hey ${firstName} — it's been a few hours.`;
  if (hours < 24 * 3) return `Good to see you again, ${firstName}. It's been a day or so.`;
  if (hours < 24 * 14) return `It's been a while since you were last here, ${firstName}.`;
  return `Whoa — it's been a long time since you used this computer, ${firstName}.`;
}

export default function SteveWidget() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasMetSteve = useSteveStore((s) => s.hasMetSteve);
  const recentlyUnlocked = useSteveStore((s) => s.recentlyUnlocked);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [dismissed, setDismissed] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const [showBubble, setShowBubble] = useState(false);

  const firstName = useMemo(() => (user?.name || "there").split(" ")[0], [user?.name]);

  // Opening line, once, shortly after the desktop mounts.
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => {
      setBubbleText(buildGreeting(firstName, hasMetSteve));
      setShowBubble(true);
      const hide = setTimeout(() => setShowBubble(false), 6000);
      return () => clearTimeout(hide);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Whenever an achievement unlocks anywhere in the app, Steve pipes up
  // about it — this is what makes the widget feel alive rather than just
  // a static launcher, without needing to be inside whichever app
  // triggered the unlock.
  useEffect(() => {
    if (recentlyUnlocked.length === 0) return;
    setBubbleText("Nice — you just unlocked something. Check my Achievements tab.");
    setShowBubble(true);
    const hide = setTimeout(() => setShowBubble(false), 5000);
    return () => clearTimeout(hide);
  }, [recentlyUnlocked.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated || dismissed) return null;

  const openSteve = (tab) => {
    const app = getApp("steve");
    if (!app) return;
    openWindow({
      id: "steve",
      title: "Steve",
      content: <app.component initialTab={tab} />,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
    });
    setDockOpen(false);
  };

  const openDockApp = (appId) => {
    const app = getApp(appId);
    if (!app) return;
    openWindow({
      id: appId,
      title: app.title,
      content: <app.component />,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
    });
    setDockOpen(false);
  };

  return (
    <div
      className="fixed right-4 z-40 flex flex-col items-end gap-2"
      style={{ bottom: TASKBAR_HEIGHT + 16 }}
    >
      {/* speech bubble */}
      {showBubble && bubbleText && (
        <div
          onClick={() => setShowBubble(false)}
          className="mr-1 max-w-[220px] cursor-pointer animate-[bubble-in_0.25s_ease-out] rounded-2xl rounded-br-sm border border-border bg-background-elevated px-3 py-2 text-[11.5px] leading-snug text-foreground shadow-lg backdrop-blur-xl"
        >
          {bubbleText}
        </div>
      )}

      {/* mini dock — expands upward above the avatar */}
      {dockOpen && (
        <div className="mr-1 flex animate-[dock-in_0.18s_ease-out] flex-col gap-1 rounded-2xl border border-border bg-background-elevated p-1.5 shadow-xl backdrop-blur-xl">
          <button
            onClick={() => openSteve("welcome")}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11.5px] text-foreground-secondary transition-colors hover:bg-accent/10 hover:text-accent"
          >
            <MessageCircle size={14} />
            Open Steve
          </button>
          <div className="my-0.5 h-px bg-border" />
          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.appId}
                onClick={() => openDockApp(item.appId)}
                className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11.5px] text-foreground-secondary transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}

      {/* avatar bubble */}
      <div className="group relative">
        <button
          onClick={() => setDockOpen((v) => !v)}
          title="Steve"
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background-elevated shadow-lg backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
        >
          <SteveAvatar talking={showBubble} size="sm" />
        </button>
        <span
          className={`pointer-events-none absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-background-elevated text-foreground-secondary shadow transition-transform ${
            dockOpen ? "rotate-180" : ""
          }`}
        >
          <ChevronDown size={11} />
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
          }}
          title="Hide Steve for this session"
          className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-background-elevated text-foreground-secondary opacity-0 shadow transition-opacity hover:text-red-500 group-hover:opacity-100"
        >
          <X size={9} />
        </button>
      </div>

      <style jsx global>{`
        @keyframes bubble-in {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes dock-in {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}