"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, FileText, Folder, Loader2, Plus, Archive,
  ArchiveRestore, Trash2, Eraser, Pencil, MoreVertical, MessageSquare, HelpCircle,
} from "lucide-react";
import {
  useAIAssistantStore,
  useFileSystemStore,
  useWindowStore,
  useSystemActionsStore,
} from "@/app/stores";
import { getAIResponse } from "@/app/lib/mockAiEngine";
import dynamic from "next/dynamic";
import { useContextMenu } from "@/app/components/common/ContextMenu";
import FileEditor from "@/app/components/common/FileEditor";
import CommandGuidePanel from "@/app/components/common/CommandGuidePanel";

const FileViewer = dynamic(() => import("../../components/common/FileViewer"), { ssr: false });

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
    items: [
      { example: "what's in my workspace?", description: "A quick file/folder count summary." },
    ],
  },
];

export default function AIAssistantApp() {
  const conversations = useAIAssistantStore((s) => s.conversations);
  const activeId = useAIAssistantStore((s) => s.activeId);
  const thinking = useAIAssistantStore((s) => s.thinking);
  const setActiveId = useAIAssistantStore((s) => s.setActiveId);
  const createConversation = useAIAssistantStore((s) => s.createConversation);
  const appendMessage = useAIAssistantStore((s) => s.appendMessage);
  const renameConversation = useAIAssistantStore((s) => s.renameConversation);
  const archiveConversation = useAIAssistantStore((s) => s.archiveConversation);
  const deleteConversation = useAIAssistantStore((s) => s.deleteConversation);
  const clearConversation = useAIAssistantStore((s) => s.clearConversation);
  const setThinking = useAIAssistantStore((s) => s.setThinking);

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

    const response = await getAIResponse({ message: trimmed });

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
      content: node.imported ? <FileViewer fileId={node.id} /> : <FileEditor fileId={node.id} />,
      width: 700,
      height: 480,
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
    <div className="relative flex h-full bg-background text-foreground">
      {/* left sidebar — conversation list */}
      <div className="flex w-44 shrink-0 flex-col border-r border-border">
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
            <Sparkles size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{active?.title ?? "Assistant"}</p>
            <p className="text-[10px] text-foreground-secondary">akaza · workspace assistant</p>
          </div>
          <button
            onClick={() => setHelpOpen(true)}
            title="What can akaza do?"
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
                  Thinking...
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
            placeholder="Ask about your workspace..."
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
        title="What akaza can do"
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