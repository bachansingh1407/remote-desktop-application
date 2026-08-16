"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderOpen,
  Megaphone,
  Code2,
  Terminal as TerminalIcon,
  Trash2,
  Maximize2,
  X,
  Trophy,
  LayoutGrid,
} from "lucide-react";
import { useWindowStore, useAuthStore, useFileSystemStore, useSystemActionsStore } from "@/app/stores";
import { useSteveStore, ACHIEVEMENTS } from "@/app/stores/useSteveStore";
import { useSteveConversation } from "@/app/lib/useSteveConversation";
import { computeNotificationCount, LAST_SEEN_KEY as INSIGHTS_LAST_SEEN_KEY } from "@/app/lib/steveInsights";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { getApp } from "@/app/lib/appRegistry";
import { getFileWindowContent, getFileWindowSize } from "@/app/lib/fileOpeners";
import SteveAvatar from "@/app/components/steve/SteveAvatar";
import SteveChatThread from "@/app/components/steve/SteveChatThread";

const DOCK_ITEMS = [
  { appId: "files", label: "Files", icon: FolderOpen },
  { appId: "community", label: "Community", icon: Megaphone },
  { appId: "snippets", label: "Snippets", icon: Code2 },
  { appId: "tool-console", label: "Console", icon: TerminalIcon },
  { appId: "trash", label: "Trash", icon: Trash2 },
];

const SUGGESTED_PROMPTS = ["What's in my workspace?", "Open Files"];

function buildGreeting(firstName, hasMetSteve) {
  if (typeof window === "undefined") return `Hey ${firstName}.`;
  const lastSeenRaw = localStorage.getItem(INSIGHTS_LAST_SEEN_KEY);
  const now = Date.now();
  localStorage.setItem(INSIGHTS_LAST_SEEN_KEY, String(now));

  if (!lastSeenRaw) {
    return hasMetSteve ? `Hey ${firstName}, good to see you.` : `Hey ${firstName} — I'm Steve. Click me and let's talk.`;
  }
  const hours = (now - Number(lastSeenRaw)) / (1000 * 60 * 60);
  if (hours < 0.05) return `Back already, ${firstName}?`;
  if (hours < 6) return `Welcome back, ${firstName}.`;
  if (hours < 24) return `Hey ${firstName} — it's been a few hours.`;
  if (hours < 24 * 3) return `Good to see you again, ${firstName}.`;
  if (hours < 24 * 14) return `It's been a while, ${firstName}.`;
  return `Whoa — it's been a long time since you used this computer, ${firstName}.`;
}

export default function SteveWidget() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const unlockedIds = useSteveStore((s) => s.unlockedIds);
  const recentlyUnlocked = useSteveStore((s) => s.recentlyUnlocked);
  const hasMetSteve = useSteveStore((s) => s.hasMetSteve);
  const openWindow = useWindowStore((s) => s.openWindow);
  const nodes = useFileSystemStore((s) => s.items);
  const runAction = useSystemActionsStore((s) => s.runAction);

  const [dismissed, setDismissed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const firstName = useMemo(() => (user?.name || "there").split(" ")[0], [user?.name]);
  const { messages, thinking, send } = useSteveConversation();

  // Recomputed on an interval rather than tied to every store change —
  // insights read across multiple stores (files, community), so a light
  // periodic check is simpler and cheap enough for a badge count.
  useEffect(() => {
    if (!isAuthenticated) return;
    const compute = () => setNotifCount(computeNotificationCount());
    compute();
    const interval = setInterval(compute, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (recentlyUnlocked.length === 0 || chatOpen) return;
    setBubbleText("Nice — you just unlocked something new.");
    setShowBubble(true);
    const hide = setTimeout(() => setShowBubble(false), 5000);
    return () => clearTimeout(hide);
  }, [recentlyUnlocked.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated || dismissed) return null;

  const openFileRef = (ref) => {
    if (ref.type === "folder") {
      runAction("openApp", { appId: "files" });
      return;
    }
    const node = nodes?.[ref.id];
    if (!node) return;
    openWindow({
      id: `file-${node.id}`,
      title: node.name,
      content: getFileWindowContent(node),
      ...getFileWindowSize(node),
    });
  };

  const openFullSteve = (screen = "chat") => {
    const app = getApp("steve");
    if (!app) return;
    openWindow({
      id: "steve",
      title: "Steve",
      content: <app.component initialTab={screen} />,
      width: app.width,
      height: app.height,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
    });
    setChatOpen(false);
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
  };

  const toggleChat = () => {
    setShowBubble(false);
    setChatOpen((v) => !v);
  };

  return (
    <div className="fixed right-4 z-40 flex flex-col items-end gap-2" style={{ bottom: TASKBAR_HEIGHT + 16 }}>
      {/* speech bubble — only while the chat popup itself is closed */}
      {!chatOpen && showBubble && bubbleText && (
        <div
          onClick={() => setShowBubble(false)}
          className="mr-1 max-w-[220px] cursor-pointer animate-[bubble-in_0.25s_ease-out] rounded-2xl rounded-br-sm border border-border bg-background-elevated px-3 py-2 text-[11.5px] leading-snug text-foreground shadow-lg backdrop-blur-xl"
        >
          {bubbleText}
        </div>
      )}

      {/* real-time chat popup */}
      {chatOpen && (
        <div className="mr-1 flex h-[480px] w-[340px] animate-[popup-in_0.2s_ease-out] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background-secondary/60 px-3.5 py-2.5">
            <SteveAvatar talking={thinking} size="xs" showStatus />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold leading-tight">Steve</p>
              {/* <p className="text-[10px] text-foreground-secondary">{thinking ? "typing…" : "head of operations"}</p> */}
            </div>
            <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9.5px] font-semibold text-accent">
              <Trophy size={9} />
              {unlockedIds.length}/{ACHIEVEMENTS.length}
            </span>
            <button
              onClick={() => openFullSteve("home")}
              title="Open dashboard"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
            >
              <LayoutGrid size={12} />
            </button>
            <button
              onClick={() => openFullSteve("chat")}
              title="Open full app"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
            >
              <Maximize2 size={12} />
            </button>
            <button
              onClick={() => setChatOpen(false)}
              title="Close"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
            >
              <X size={12} />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <SteveChatThread
              messages={messages}
              thinking={thinking}
              onSend={send}
              onOpenFileRef={openFileRef}
              compact
              suggestions={SUGGESTED_PROMPTS}
              placeholder="Message Steve..."
            />
          </div>

          <div className="flex shrink-0 items-center justify-center gap-1 border-t border-border bg-background-secondary/40 px-2 py-1.5">
            {DOCK_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.appId}
                  onClick={() => openDockApp(item.appId)}
                  title={item.label}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-black/[0.06] hover:text-accent dark:hover:bg-white/[0.08]"
                >
                  <Icon size={13} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* avatar bubble */}
      <div className="group relative">
        <button
          onClick={toggleChat}
          title="Chat with Steve"
          className="relative flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background-elevated shadow-lg backdrop-blur-xl transition-transform hover:scale-105 active:scale-95"
        >
          <SteveAvatar talking={thinking} size="sm" showStatus={!chatOpen} />
        </button>

        {!chatOpen && notifCount > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openFullSteve("home");
            }}
            title={`${notifCount} thing${notifCount === 1 ? "" : "s"} worth a look`}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-red-500 text-[9px] font-bold text-white shadow-sm"
          >
            {notifCount}
          </button>
        )}

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
        @keyframes popup-in {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}