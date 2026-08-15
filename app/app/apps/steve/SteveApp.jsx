"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  MessageCircle,
  Trophy,
  Info,
  ChevronRight,
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
  Terminal,
  Send,
  Loader2,
  Plus,
  Archive,
  ArchiveRestore,
  Trash2,
  Eraser,
  Pencil,
  MoreVertical,
  MessageSquare,
  HelpCircle,
  Folder,
  FileText,
  Squirrel,
} from "lucide-react";
import { useSteveStore, ACHIEVEMENTS } from "@/app/stores/useSteveStore";
import { useSteveOpsStore } from "@/app/stores/useSteveOpsStore";
import { useAuthStore, useFileSystemStore, useWindowStore, useSystemActionsStore } from "@/app/stores";
import { getSteveOpsResponse } from "@/app/lib/steveEngine";
import { useContextMenu } from "@/app/components/common/ContextMenu";
import CommandGuidePanel from "@/app/components/common/CommandGuidePanel";
import { getFileWindowContent, getFileWindowSize } from "@/app/lib/fileOpeners";

// Maps the string icon keys in the achievement catalog to real components,
// so useSteveStore.js can stay framework-agnostic plain data.
const ICON_MAP = { Hand, Compass, FolderOpen, NotebookPen, Code2, Calendar, Megaphone, Trophy };

const SUGGESTED_PROMPTS = [
  "What's in my workspace?",
  "Open Files",
  "Create a folder called Interview Prep",
];

const HELP_SECTIONS = [
  {
    title: "Navigate",
    items: [
      { example: "open folder Documents/Projects", description: "Jump straight to a folder by path — nested paths work too." },
      { example: "what's in Documents", description: "List the contents of a folder without opening it." },
      { example: "open Files", description: "Launch any app by name (Write, Tasks, Snippets, Settings, ...)." },
    ],
  },
  {
    title: "Manage files",
    items: [
      { example: "create a folder called Ideas", description: "Creates it in your workspace root." },
      { example: "create a note called Meeting Notes", description: "Same, but a blank file instead of a folder." },
      { example: "rename Ideas to Archive", description: "Renames the first match by name." },
      { example: "trash Old Draft", description: "Moves the first match to Trash." },
      { example: "find budget", description: "Searches every file and folder by name." },
    ],
  },
  {
    title: "Workspace",
    items: [{ example: "what's in my workspace?", description: "A quick file/folder count summary." }],
  },
];

// ---------------------------------------------------------------------------
// Steve's welcome dialogue script. Written once here, played back with a
// typewriter effect. `name` is substituted with the logged-in user's first
// name.
// ---------------------------------------------------------------------------
function buildScript(firstName) {
  return [
    `Hey ${firstName}, I'm Steve — think of me as the guy who runs the front desk AND the back office here.`,
    "Welcome to Campus. It's a full desktop that lives in your browser — windows, a taskbar, files, the whole thing.",
    "A developer named Bachan built this, from the ground up — frontend, backend, database, all of it. Full-stack, one person.",
    "Every app you see was built by hand for this: Files for your stuff, Write for notes, Snippets for code you want to keep, Calendar for your schedule.",
    "There's also a Community wall — pin a name and a message, anyone using Campus can see it. Feedback, ideas, whatever's on your mind.",
    "And if you ever want something DONE instead of explained — head to my Operations tab. Tell me to open something, create a folder, search your files, whatever. I'll handle it.",
    "Poke around and I'll quietly keep score too — open a few apps, pin something, and you'll unlock things over in Achievements.",
    "That's the tour. Go on, go make yourself at home — I'll be right here.",
  ];
}

const TYPE_SPEED_MS = 16; // per character
const LINE_PAUSE_MS = 420;

function useTypewriter(lines, active) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    clearTimeout(timerRef.current);

    const currentLine = lines[lineIndex] || "";

    if (charIndex < currentLine.length) {
      timerRef.current = setTimeout(() => setCharIndex((c) => c + 1), TYPE_SPEED_MS);
    } else if (lineIndex < lines.length - 1) {
      timerRef.current = setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, LINE_PAUSE_MS + 380);
    } else {
      setDone(true);
    }

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, charIndex, lineIndex]);

  const skipToEnd = () => {
    clearTimeout(timerRef.current);
    setLineIndex(lines.length - 1);
    setCharIndex((lines[lines.length - 1] || "").length);
    setDone(true);
  };

  const visibleLines = lines.slice(0, lineIndex).concat(lines[lineIndex]?.slice(0, charIndex) ?? "");
  const isTypingCurrentLine = charIndex < (lines[lineIndex] || "").length;

  return { visibleLines, isTypingCurrentLine, done, skipToEnd, lineIndex };
}

export function SteveAvatar({ talking, size = "md" }) {
  const dims = size === "sm" ? { outer: "h-10 w-10", inner: "h-9 w-9", icon: 17 } : { outer: "h-16 w-16", inner: "h-14 w-14", icon: 26 };
  return (
    <div className={`relative flex ${dims.outer} shrink-0 items-center justify-center`}>
      <div
        className="absolute inset-0 rounded-full opacity-70 blur-md"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />
      <div
        className={`relative flex ${dims.inner} items-center justify-center rounded-full border-2 border-accent/40 bg-gradient-to-br from-accent/25 to-accent/5 text-accent shadow-lg transition-transform ${
          talking ? "animate-[steve-bob_1.4s_ease-in-out_infinite]" : ""
        }`}
      >
        <Squirrel size={dims.icon} />
      </div>
      {talking && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
        </span>
      )}
    </div>
  );
}

function WelcomeTab() {
  const user = useAuthStore((s) => s.user);
  const hasMetSteve = useSteveStore((s) => s.hasMetSteve);
  const completeFirstMeeting = useSteveStore((s) => s.completeFirstMeeting);

  const firstName = useMemo(() => (user?.name || "there").split(" ")[0], [user?.name]);
  const script = useMemo(() => buildScript(firstName), [firstName]);

  const [active, setActive] = useState(true);
  const { visibleLines, isTypingCurrentLine, done, skipToEnd, lineIndex } = useTypewriter(script, active);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleLines.length]);

  useEffect(() => {
    if (done && !hasMetSteve) completeFirstMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const replay = () => {
    setActive(false);
    setTimeout(() => setActive(true), 30);
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <div className="flex items-start gap-3">
          <SteveAvatar talking={!done} />
          <div className="flex-1 space-y-2 pt-1.5">
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className="max-w-md rounded-2xl rounded-tl-sm border border-border bg-background-secondary px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm"
              >
                {line}
                {i === lineIndex && isTypingCurrentLine && (
                  <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-accent align-middle" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
        <p className="text-[11px] text-foreground-secondary">
          {done ? "That's everything for now." : "Steve is talking…"}
        </p>
        <div className="flex gap-2">
          {!done && (
            <button
              onClick={skipToEnd}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] text-foreground-secondary transition-colors hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
            >
              Skip <ChevronRight size={12} />
            </button>
          )}
          {done && (
            <button
              onClick={replay}
              className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white transition-transform hover:brightness-110 active:scale-95"
            >
              Hear it again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operations tab — this IS what used to be the separate "akaza" AI
// Assistant app. Same conversation architecture, same command engine,
// fully absorbed into Steve so there's one assistant in Campus, not two.
// ---------------------------------------------------------------------------
function OperationsTab() {
  const conversations = useSteveOpsStore((s) => s.conversations);
  const activeId = useSteveOpsStore((s) => s.activeId);
  const thinking = useSteveOpsStore((s) => s.thinking);
  const setActiveId = useSteveOpsStore((s) => s.setActiveId);
  const createConversation = useSteveOpsStore((s) => s.createConversation);
  const appendMessage = useSteveOpsStore((s) => s.appendMessage);
  const renameConversation = useSteveOpsStore((s) => s.renameConversation);
  const archiveConversation = useSteveOpsStore((s) => s.archiveConversation);
  const deleteConversation = useSteveOpsStore((s) => s.deleteConversation);
  const clearConversation = useSteveOpsStore((s) => s.clearConversation);
  const setThinking = useSteveOpsStore((s) => s.setThinking);

  const { openMenu } = useContextMenu();
  const [input, setInput] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const scrollRef = useRef(null);

  const nodes = useFileSystemStore((s) => s.items);
  const openWindow = useWindowStore((s) => s.openWindow);
  const runAction = useSystemActionsStore((s) => s.runAction);

  const active = conversations[activeId];
  const list = Object.values(conversations).sort((a, b) => b.updatedAt - a.updatedAt);
  const visibleList = list.filter((c) => c.archived === showArchived);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages, thinking]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || thinking || !active) return;

    appendMessage(active.id, { role: "user", text: trimmed });
    setInput("");
    setThinking(true);

    const response = await getSteveOpsResponse({ message: trimmed });

    appendMessage(active.id, { role: "assistant", ...response });
    setThinking(false);
  };

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

  const handleRename = (convo) => {
    const title = window.prompt("Rename chat:", convo.title);
    if (title) renameConversation(convo.id, title);
  };

  const handleConvoMenu = (e, convo) => {
    openMenu(e, [
      { label: "Rename", icon: Pencil, onClick: () => handleRename(convo) },
      { label: "Clear messages", icon: Eraser, onClick: () => clearConversation(convo.id) },
      { divider: true },
      convo.archived
        ? { label: "Unarchive", icon: ArchiveRestore, onClick: () => archiveConversation(convo.id, false) }
        : { label: "Archive", icon: Archive, onClick: () => archiveConversation(convo.id, true) },
      {
        label: "Delete",
        icon: Trash2,
        danger: true,
        onClick: () => {
          if (window.confirm(`Delete "${convo.title}"? This can't be undone.`)) {
            deleteConversation(convo.id);
            if (convo.id === activeId) {
              const remaining = list.filter((c) => c.id !== convo.id && !c.archived);
              setActiveId(remaining[0]?.id ?? createConversation());
            }
          }
        },
      },
    ]);
  };

  return (
    <div className="relative flex h-full">
      {/* conversation list */}
      <div className="flex w-40 shrink-0 flex-col border-r border-border">
        <div className="p-2">
          <button
            onClick={createConversation}
            className="flex w-full items-center gap-1.5 rounded-md bg-accent/15 px-2.5 py-1.5 text-xs text-accent hover:bg-accent/25"
          >
            <Plus size={13} />
            New chat
          </button>
        </div>

        <div className="flex shrink-0 gap-0.5 px-2 pb-1">
          <button
            onClick={() => setShowArchived(false)}
            className={`flex-1 rounded-md px-2 py-1 text-[10px] transition-colors
              ${!showArchived ? "bg-black/[0.06] dark:bg-white/[0.08] text-foreground" : "text-foreground-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}`}
          >
            Chats
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`flex-1 rounded-md px-2 py-1 text-[10px] transition-colors
              ${showArchived ? "bg-black/[0.06] dark:bg-white/[0.08] text-foreground" : "text-foreground-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}`}
          >
            Archived
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {visibleList.length === 0 ? (
            <p className="px-2 py-4 text-center text-[10px] text-foreground-secondary/60">
              {showArchived ? "No archived chats" : "No chats yet"}
            </p>
          ) : (
            visibleList.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                onContextMenu={(e) => handleConvoMenu(e, c)}
                className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors
                  ${c.id === activeId ? "bg-black/[0.06] dark:bg-white/[0.08]" : "hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"}`}
              >
                <MessageSquare size={11} className="shrink-0 text-foreground-secondary/60" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground-secondary">{c.title}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConvoMenu(e, c);
                  }}
                  className="shrink-0 rounded p-0.5 text-transparent group-hover:text-foreground-secondary hover:!text-foreground"
                >
                  <MoreVertical size={11} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* chat panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Terminal size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{active?.title ?? "Operations"}</p>
            <p className="text-[10px] text-foreground-secondary">Steve · head of operations</p>
          </div>
          <button
            onClick={() => setHelpOpen(true)}
            title="What can Steve do?"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
            <HelpCircle size={15} />
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
            {active?.messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed
                    ${m.role === "user" ? "bg-accent text-white" : "bg-black/[0.04] dark:bg-white/[0.06] text-foreground"}`}
                >
                  <p>{m.text}</p>
                  {m.fileRef && (
                    <button
                      onClick={() => openFileRef(m.fileRef)}
                      className="mt-2 flex w-full items-center gap-2 rounded-md bg-black/10 dark:bg-black/20 px-2.5 py-1.5 text-left hover:bg-black/20 dark:hover:bg-black/30"
                    >
                      {m.fileRef.type === "folder" ? (
                        <Folder size={13} className="text-accent" />
                      ) : (
                        <FileText size={13} className="text-amber-500" />
                      )}
                      <span className="truncate">{m.fileRef.name}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {thinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 text-xs text-foreground-secondary">
                  <Loader2 size={12} className="animate-spin" />
                  Working on it...
                </div>
              </div>
            )}
          </div>
        </div>

        {active?.messages.length === 1 && (
          <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="rounded-full border border-border bg-black/[0.03] dark:bg-white/[0.04] px-2.5 py-1 text-[10px] text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-t border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Tell Steve what you need..."
            className="flex-1 rounded-lg border border-border bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2 text-xs
                       text-foreground outline-none placeholder-foreground-secondary/60 focus:border-accent/50"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors
              ${!input.trim() || thinking ? "cursor-not-allowed text-foreground-secondary/40" : "bg-accent text-white hover:opacity-90"}`}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      <CommandGuidePanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="What Steve can do"
        subtitle="Tap any example to try it"
        sections={HELP_SECTIONS}
        onPick={(example) => {
          setHelpOpen(false);
          send(example);
        }}
      />
    </div>
  );
}

function AchievementsTab() {
  const unlockedIds = useSteveStore((s) => s.unlockedIds);
  const recentlyUnlocked = useSteveStore((s) => s.recentlyUnlocked);
  const unlockedCount = unlockedIds.length;
  const total = ACHIEVEMENTS.length;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-5 pt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-foreground-secondary">
          <span>Progress</span>
          <span>
            {unlockedCount}/{total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(unlockedCount / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-5">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = unlockedIds.includes(a.id);
          const justUnlocked = recentlyUnlocked.includes(a.id);
          const Icon = ICON_MAP[a.icon] || Trophy;

          return (
            <div
              key={a.id}
              className={`relative flex flex-col gap-2 rounded-xl border p-3 transition-all duration-300 ${
                unlocked
                  ? "border-accent/30 bg-accent/[0.06]"
                  : "border-border bg-background-secondary opacity-60 grayscale"
              } ${justUnlocked ? "animate-[achievement-pop_0.6s_ease-out]" : ""}`}
            >
              {justUnlocked && (
                <span className="absolute inset-0 rounded-xl bg-accent/20 animate-[achievement-glow_1.6s_ease-out]" />
              )}
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  unlocked ? "bg-accent/20 text-accent" : "bg-black/10 text-foreground-secondary dark:bg-white/10"
                }`}
              >
                {unlocked ? <Icon size={16} /> : <Lock size={14} />}
              </div>
              <div>
                <p className="text-[12.5px] font-semibold leading-tight">{a.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-foreground-secondary">{a.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx global>{`
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
        @keyframes achievement-glow {
          0% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function AboutTab() {
  const facts = [
    { label: "Built by", value: "Bachan Singh — full-stack developer" },
    { label: "Based in", value: "Chandigarh, India" },
    { label: "Stack", value: "Next.js, React, Zustand, Express, Prisma, PostgreSQL" },
    { label: "GitHub", value: "bachansingh1407" },
  ];

  return (
    <div className="h-full space-y-4 overflow-y-auto p-5">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background-secondary p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-[13px] font-semibold">Campus</p>
          <p className="text-[11px] text-foreground-secondary">A desktop operating system that lives in your browser tab.</p>
        </div>
      </div>

      <div className="rounded-xl border border-border">
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={`flex items-center justify-between px-4 py-2.5 text-[12px] ${
              i !== facts.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <span className="text-foreground-secondary">{f.label}</span>
            <span className="font-medium">{f.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary p-3 text-[11px] text-foreground-secondary">
        <Terminal size={13} className="shrink-0" />
        <span>Every window, every store, every route — handwritten for this project, not a template.</span>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background-secondary p-3 text-[11px] text-foreground-secondary">
        <Terminal size={13} className="shrink-0" />
        <span>Steve is the one assistant in Campus — the guide AND the operator. Nothing else runs commands for you.</span>
      </div>
    </div>
  );
}

const TABS = [
  { id: "welcome", label: "Welcome", icon: MessageCircle },
  { id: "operations", label: "Operations", icon: Terminal },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "about", label: "About", icon: Info },
];

export default function SteveApp({ initialTab } = {}) {
  const [tab, setTab] = useState(initialTab || "welcome");
  const unlockedIds = useSteveStore((s) => s.unlockedIds);

  return (
    <div className="flex h-full bg-background text-foreground">
      <nav className="flex w-40 shrink-0 flex-col gap-1 border-r border-border p-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <SteveAvatar talking={false} size="sm" />
          <div>
            <p className="text-[12.5px] font-semibold leading-tight">Steve</p>
            <p className="text-[10px] text-foreground-secondary">head of operations</p>
          </div>
        </div>
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] transition-colors ${
                isActive
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon size={14} />
              <span className="flex-1">{t.label}</span>
              {t.id === "achievements" && (
                <span className="rounded-full bg-black/10 px-1.5 text-[9.5px] dark:bg-white/10">
                  {unlockedIds.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1">
        {tab === "welcome" && <WelcomeTab />}
        {tab === "operations" && <OperationsTab />}
        {tab === "achievements" && <AchievementsTab />}
        {tab === "about" && <AboutTab />}
      </div>

      <style jsx global>{`
        @keyframes steve-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>
    </div>
  );
}