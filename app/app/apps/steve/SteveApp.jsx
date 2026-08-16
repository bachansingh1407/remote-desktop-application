"use client";

import { useState } from "react";
import {
  Plus,
  Archive,
  Trash2,
  Eraser,
  Pencil,
  MoreVertical,
  ChevronsLeft,
  ChevronsRight,
  Trophy,
  X,
  Lock,
  Hand,
  Compass,
  FolderOpen,
  NotebookPen,
  Code2,
  Calendar,
  Megaphone,
  Sparkles,
  // Github,
  LayoutGrid,
  MessageCircle,
  Terminal,
} from "lucide-react";
import { useSteveStore, ACHIEVEMENTS } from "@/app/stores/useSteveStore";
import { useSteveOpsStore } from "@/app/stores/useSteveOpsStore";
import { useFileSystemStore, useWindowStore, useSystemActionsStore } from "@/app/stores";
import { useSteveConversation } from "@/app/lib/useSteveConversation";
import { useContextMenu } from "@/app/components/common/ContextMenu";
import { getFileWindowContent, getFileWindowSize } from "@/app/lib/fileOpeners";
import SteveAvatar from "@/app/components/steve/SteveAvatar";
import SteveChatThread from "@/app/components/steve/SteveChatThread";
import SteveHome from "@/app/apps/steve/SteveHome";

const ICON_MAP = { Hand, Compass, FolderOpen, NotebookPen, Code2, Calendar, Megaphone, Trophy };

const SUGGESTED_PROMPTS = [
  "What's in my workspace?",
  "Open Files",
  "Create a folder for interview prep",
  "Who built Campus?",
];

// Deterministic colour + initial for a conversation's rail avatar — same
// idea as Community's visitor tags, so the rail is scannable at a glance
// even collapsed.
const RAIL_COLORS = ["#F59E0B", "#10B981", "#38BDF8", "#F472B6", "#A78BFA", "#FB923C", "#34D399"];
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function railColorFor(seed) {
  return RAIL_COLORS[hashString(seed) % RAIL_COLORS.length];
}

// ---------------------------------------------------------------------------
// Conversation rail — collapsed to a slim icon strip by default (scannable,
// out of the way), expandable to show full titles. Behaves like a real
// chat app's sidebar, not the old fixed 160px list.
// ---------------------------------------------------------------------------
function ConversationRail({ expanded, onToggle }) {
  const conversations = useSteveOpsStore((s) => s.conversations);
  const activeId = useSteveOpsStore((s) => s.activeId);
  const setActiveId = useSteveOpsStore((s) => s.setActiveId);
  const createConversation = useSteveOpsStore((s) => s.createConversation);
  const renameConversation = useSteveOpsStore((s) => s.renameConversation);
  const archiveConversation = useSteveOpsStore((s) => s.archiveConversation);
  const deleteConversation = useSteveOpsStore((s) => s.deleteConversation);
  const clearConversation = useSteveOpsStore((s) => s.clearConversation);
  const { openMenu } = useContextMenu();

  const list = Object.values(conversations)
    .filter((c) => !c.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleMenu = (e, convo) => {
    openMenu(e, [
      {
        label: "Rename",
        icon: Pencil,
        onClick: () => {
          const title = window.prompt("Rename chat:", convo.title);
          if (title) renameConversation(convo.id, title);
        },
      },
      { label: "Clear messages", icon: Eraser, onClick: () => clearConversation(convo.id) },
      { divider: true },
      { label: "Archive", icon: Archive, onClick: () => archiveConversation(convo.id, true) },
      {
        label: "Delete",
        icon: Trash2,
        danger: true,
        onClick: () => {
          if (window.confirm(`Delete "${convo.title}"? This can't be undone.`)) {
            deleteConversation(convo.id);
            if (convo.id === activeId) {
              const remaining = list.filter((c) => c.id !== convo.id);
              setActiveId(remaining[0]?.id ?? createConversation());
            }
          }
        },
      },
    ]);
  };

  return (
    <div
      className={`flex shrink-0 flex-col border-r border-border bg-background-secondary/30 transition-[width] duration-200 ${
        expanded ? "w-52" : "w-14"
      }`}
    >
      <div className={`flex shrink-0 items-center gap-1 p-2 ${expanded ? "justify-between" : "flex-col"}`}>
        <button
          onClick={() => createConversation()}
          title="New chat"
          className={`flex items-center gap-1.5 rounded-xl bg-accent/15 text-accent transition-colors hover:bg-accent/25 ${
            expanded ? "flex-1 justify-center px-3 py-2 text-[11.5px] font-medium" : "h-9 w-9 justify-center"
          }`}
        >
          <Plus size={14} />
          {expanded && "New chat"}
        </button>
        <button
          onClick={onToggle}
          title={expanded ? "Collapse" : "Expand"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
        >
          {expanded ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {list.map((c) => {
          const isActive = c.id === activeId;
          const color = railColorFor(c.id);
          return (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              onContextMenu={(e) => handleMenu(e, c)}
              title={c.title}
              className={`group flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors ${
                isActive ? "bg-accent/12" : "hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              } ${expanded ? "" : "justify-center"}`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {c.title.trim()[0]?.toUpperCase() || "C"}
              </span>
              {expanded && (
                <>
                  <span
                    className={`min-w-0 flex-1 truncate text-[11.5px] ${
                      isActive ? "font-medium text-foreground" : "text-foreground-secondary"
                    }`}
                  >
                    {c.title}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMenu(e, c);
                    }}
                    className="shrink-0 rounded p-1 text-transparent group-hover:text-foreground-secondary hover:!text-foreground"
                  >
                    <MoreVertical size={12} />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile drawer — Achievements + About, slid in from the right on demand
// instead of living as permanent tabs. Chat is the app; this is auxiliary.
// ---------------------------------------------------------------------------
function ProfileDrawer({ onClose }) {
  const [section, setSection] = useState("achievements");
  const unlockedIds = useSteveStore((s) => s.unlockedIds);
  const recentlyUnlocked = useSteveStore((s) => s.recentlyUnlocked);
  const unlockedCount = unlockedIds.length;
  const total = ACHIEVEMENTS.length;

  const facts = [
    { label: "Built by", value: "Bachan Singh" },
    { label: "Based in", value: "Chandigarh, India" },
    { label: "Stack", value: "Next.js · Zustand · Express · Prisma · PostgreSQL" },
    { label: "Steve runs on", value: "Groq (Llama) — real reasoning" },
    { label: "GitHub", value: "bachansingh1407" },
  ];

  return (
    <div
      className="absolute inset-0 z-30 flex justify-end bg-black/30 backdrop-blur-[2px]"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-full w-[320px] animate-[drawer-in_0.2s_ease-out] flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center gap-3 border-b border-border p-4">
          <SteveAvatar size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight">Steve</p>
            <p className="text-[10.5px] text-foreground-secondary">
              {unlockedCount}/{total} achievements unlocked
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-border p-2">
          {[
            { id: "achievements", label: "Achievements" },
            { id: "about", label: "About" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex-1 rounded-lg py-1.5 text-[11.5px] font-medium transition-colors ${
                section === s.id
                  ? "bg-accent/15 text-accent"
                  : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {section === "achievements" ? (
            <div className="p-4">
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${(unlockedCount / total) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {ACHIEVEMENTS.map((a) => {
                  const unlocked = unlockedIds.includes(a.id);
                  const justUnlocked = recentlyUnlocked.includes(a.id);
                  const Icon = ICON_MAP[a.icon] || Trophy;
                  return (
                    <div
                      key={a.id}
                      className={`relative flex flex-col gap-1.5 rounded-xl border p-2.5 transition-all duration-300 ${
                        unlocked
                          ? "border-accent/30 bg-accent/[0.06]"
                          : "border-border bg-background-secondary opacity-60 grayscale"
                      } ${justUnlocked ? "animate-[achievement-pop_0.6s_ease-out]" : ""}`}
                    >
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          unlocked ? "bg-accent/20 text-accent" : "bg-black/10 text-foreground-secondary dark:bg-white/10"
                        }`}
                      >
                        {unlocked ? <Icon size={13} /> : <Lock size={11} />}
                      </div>
                      <p className="text-[11px] font-semibold leading-tight">{a.title}</p>
                      <p className="text-[9.5px] leading-snug text-foreground-secondary">{a.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background-secondary p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Sparkles size={16} />
                </div>
                <p className="text-[11.5px] text-foreground-secondary">A desktop OS that lives in your browser tab.</p>
              </div>
              <div className="rounded-xl border border-border">
                {facts.map((f, i) => (
                  <div
                    key={f.label}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 text-[11.5px] ${
                      i !== facts.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <span className="shrink-0 text-foreground-secondary">{f.label}</span>
                    <span className="text-right font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary p-2.5 text-[10.5px] text-foreground-secondary">
                <Terminal size={12} className="shrink-0" />
                <span>Every window, every store, every route — handwritten, not a template.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes drawer-in {
          0% {
            opacity: 0;
            transform: translateX(16px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes achievement-pop {
          0% {
            transform: scale(0.9);
          }
          40% {
            transform: scale(1.04);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default function SteveApp({ initialTab } = {}) {
  const [screen, setScreen] = useState(initialTab === "chat" ? "chat" : "home");
  const [railExpanded, setRailExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const unlockedIds = useSteveStore((s) => s.unlockedIds);
  const nodes = useFileSystemStore((s) => s.items);
  const openWindow = useWindowStore((s) => s.openWindow);
  const runAction = useSystemActionsStore((s) => s.runAction);

  const { messages, thinking, send } = useSteveConversation();

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

  return (
    <div className="relative flex h-full bg-background text-foreground">
      {screen === "chat" && <ConversationRail expanded={railExpanded} onToggle={() => setRailExpanded((v) => !v)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
          <SteveAvatar talking={thinking} size="xs" showStatus />
          <div className="min-w-0 flex-1">
            {/* <p className="text-[13px] font-semibold leading-tight">Steve</p> */}
            {/* <p className="text-[10.5px] text-foreground-secondary">{thinking ? "typing…" : "head of operations"}</p> */}
          </div>

          <div className="flex shrink-0 gap-0.5 rounded-full border border-border bg-background-secondary p-0.5">
            <button
              onClick={() => setScreen("home")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors ${
                screen === "home" ? "bg-accent/15 text-accent" : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              }`}
            >
              <LayoutGrid size={11} />
              Home
            </button>
            <button
              onClick={() => setScreen("chat")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium transition-colors ${
                screen === "chat" ? "bg-accent/15 text-accent" : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              }`}
            >
              <MessageCircle size={11} />
              Chat
            </button>
          </div>

          <button
            onClick={() => setDrawerOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
          >
            <Trophy size={12} />
            {unlockedIds.length}/{ACHIEVEMENTS.length}
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {screen === "home" ? (
            <SteveHome onAskSteve={() => setScreen("chat")} />
          ) : (
            <SteveChatThread
              messages={messages}
              thinking={thinking}
              onSend={send}
              onOpenFileRef={openFileRef}
              suggestions={SUGGESTED_PROMPTS}
              placeholder="Ask Steve anything, or tell him what to do..."
            />
          )}
        </div>
      </div>

      {drawerOpen && <ProfileDrawer onClose={() => setDrawerOpen(false)} />}
    </div>
  );
}