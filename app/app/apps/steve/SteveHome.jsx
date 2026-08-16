"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  FolderPlus,
  FileText as FileTextIcon,
  FolderOpen,
  Trash2,
  Megaphone,
  MessageCircle,
  HardDrive,
  FileWarning,
  Sparkles,
  X,
  Folder,
  File,
  Bot,
  ArrowRight,
  Squirrel,
} from "lucide-react";
import { useWindowStore, useFileSystemStore, useSystemActionsStore } from "@/app/stores";
import { useCommunityStore } from "@/app/stores/useCommunityStore";
import { toast } from "@/app/stores/useToastStore";
import { getApp } from "@/app/lib/appRegistry";
import { getFileWindowContent, getFileWindowSize } from "@/app/lib/fileOpeners";
import {
  computeInsights,
  computeActivityFeed,
  computeSessionBriefing,
  computeSearchResults,
  formatBytes,
  timeAgo,
} from "@/app/lib/steveInsights";

const BRIEFED_KEY = "steve:briefed-this-session";

function openApp(appId, openWindow) {
  const app = getApp(appId);
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
}

export default function SteveHome({ onAskSteve }) {
  const openWindow = useWindowStore((s) => s.openWindow);
  const runAction = useSystemActionsStore((s) => s.runAction);
  const nodes = useFileSystemStore((s) => s.items);
  const fetchPosts = useCommunityStore((s) => s.fetchPosts);
  const postsLoaded = useCommunityStore((s) => s.posts.length > 0);

  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(true);
  const [tick, setTick] = useState(0); // forces insight/activity recompute after actions

  useEffect(() => {
    if (!postsLoaded) fetchPosts();
    if (typeof window !== "undefined" && !sessionStorage.getItem(BRIEFED_KEY)) {
      setBriefingDismissed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const insights = useMemo(() => computeInsights(), [nodes, tick]);
  const activity = useMemo(() => computeActivityFeed(6), [nodes, tick, postsLoaded]);
  const briefing = useMemo(() => computeSessionBriefing(), [nodes, postsLoaded]);
  const results = useMemo(() => computeSearchResults(query), [query, nodes, postsLoaded]);

  const dismissBriefing = () => {
    setBriefingDismissed(true);
    if (typeof window !== "undefined") sessionStorage.setItem(BRIEFED_KEY, "1");
  };

  const openNode = (node) => {
    if (node.type === "folder") {
      runAction("openApp", { appId: "files" });
      return;
    }
    openWindow({
      id: `file-${node.id}`,
      title: node.name,
      content: getFileWindowContent(node),
      ...getFileWindowSize(node),
    });
  };

  const handleQuickAction = async (action) => {
    if (action === "new-folder") {
      const name = window.prompt("Folder name:", "New Folder");
      if (!name) return;
      const result = await runAction("createFolder", { parentId: null, name });
      if (result.ok) {
        toast.success("Folder created", name);
        setTick((t) => t + 1);
      } else {
        toast.error("Couldn't create folder", result.message);
      }
    } else if (action === "new-note") {
      const name = window.prompt("Note name:", "New Note");
      if (!name) return;
      const result = await runAction("createFile", { parentId: null, name, content: "" });
      if (result.ok) {
        toast.success("Note created", name);
        setTick((t) => t + 1);
      } else {
        toast.error("Couldn't create note", result.message);
      }
    } else if (action === "trash") {
      openApp("trash", openWindow);
    } else if (action === "files") {
      openApp("files", openWindow);
    } else if (action === "community") {
      openApp("community", openWindow);
    } else if (action === "ask") {
      onAskSteve?.();
    }
  };

  const hasResults = query.trim() && (results.apps.length || results.nodes.length || results.posts.length);

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* session briefing */}
      {/* {!briefingDismissed && briefing.hasNews && (
        <div className="relative mb-4 flex items-start gap-3 overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-background-secondary to-background-secondary p-3.5">
          <div
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 blur-2xl"
            style={{ background: "var(--accent)" }}
          />
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Sparkles size={15} />
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold">Since you were last here</p>
            <p className="mt-0.5 text-[11.5px] text-foreground-secondary">{briefing.summary}</p>
          </div>
          <button
            onClick={dismissBriefing}
            className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
            <X size={12} />
          </button>
        </div>
      )} */}

      {/* universal search */}
      <div className="relative mb-4">
        {/* <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-secondary/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Search apps, files, folders, Community..."
            className="w-full rounded-2xl border border-border bg-background-secondary py-2.5 pl-9 pr-3 text-[13px] outline-none transition-shadow focus:ring-2 focus:ring-accent/30"
          />
        </div> */}

        {searchFocused && hasResults && (
          <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-md border border-border bg-background shadow-xl">
            {results.apps.length > 0 && (
              <div className="border-b border-border p-1.5">
                <p className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-foreground-secondary/60">Apps</p>
                {results.apps.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onMouseDown={() => openApp(a.id, openWindow)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: `${a.color}22`, color: a.color }}>
                        <Icon size={12} />
                      </span>
                      <span className="text-[12px]">{a.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {results.nodes.length > 0 && (
              <div className="border-b border-border p-1.5 last:border-b-0">
                <p className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-foreground-secondary/60">Files & folders</p>
                {results.nodes.map((n) => (
                  <button
                    key={n.id}
                    onMouseDown={() => openNode(n)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  >
                    {n.type === "folder" ? <Folder size={13} className="text-accent" /> : <File size={13} className="text-amber-500" />}
                    <span className="truncate text-[12px]">{n.name}</span>
                  </button>
                ))}
              </div>
            )}
            {results.posts.length > 0 && (
              <div className="p-1.5">
                <p className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-wide text-foreground-secondary/60">Community</p>
                {results.posts.map((p) => (
                  <button
                    key={p.id}
                    onMouseDown={() => openApp("community", openWindow)}
                    className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  >
                    <Megaphone size={13} className="mt-0.5 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1 truncate text-[12px]">
                      <span className="font-medium">{p.name}: </span>
                      {p.message}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* quick actions */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { id: "new-folder", label: "New folder", icon: FolderPlus },
          { id: "new-note", label: "New note", icon: FileTextIcon },
          { id: "files", label: "Files", icon: FolderOpen },
          { id: "trash", label: "Trash", icon: Trash2 },
          { id: "community", label: "Community", icon: Megaphone },
          { id: "ask", label: "Ask Steve", icon: MessageCircle },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              onClick={() => handleQuickAction(a.id)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-background-secondary p-2.5 transition-colors hover:border-accent/40 hover:bg-accent/[0.05]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <Icon size={15} />
              </span>
              <span className="text-center text-[10px] font-medium leading-tight text-foreground-secondary">{a.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* insights */}
        <div className="space-y-2.5">
          <p className="px-1 text-[10.5px] font-semibold uppercase tracking-wide text-foreground-secondary/70">Workspace health</p>

          <div className="rounded-2xl border border-border bg-background-secondary p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent">
                <HardDrive size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">{formatBytes(insights.totalSizeBytes)} used</p>
                <p className="text-[10.5px] text-foreground-secondary">
                  {insights.fileCount} file{insights.fileCount === 1 ? "" : "s"} · {insights.folderCount} folder
                  {insights.folderCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {insights.largestFiles.length > 0 && (
              <div className="mt-2.5 space-y-1 border-t border-border pt-2.5">
                {insights.largestFiles.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => openNode(f)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                  >
                    <span className="truncate text-[11px] text-foreground-secondary">{f.name}</span>
                    <span className="shrink-0 text-[10px] text-foreground-secondary/60">{formatBytes(f.size)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {insights.untitledItems.length >= 1 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5">
              <FileWarning size={15} className="mt-0.5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">
                  {insights.untitledItems.length} untitled item{insights.untitledItems.length === 1 ? "" : "s"}
                </p>
                <p className="text-[10.5px] text-foreground-secondary">Still using the default name — worth a rename.</p>
              </div>
            </div>
          )}

          {insights.trashedCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-background-secondary p-3.5">
              <Trash2 size={15} className="mt-0.5 shrink-0 text-foreground-secondary" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">
                  {insights.trashedCount} item{insights.trashedCount === 1 ? "" : "s"} in Trash
                </p>
                <p className="text-[10.5px] text-foreground-secondary">
                  {insights.oldestTrashedDays > 0 ? `Oldest has been there ${insights.oldestTrashedDays}d.` : "Recently trashed."}
                </p>
              </div>
              <button
                onClick={() => openApp("trash", openWindow)}
                className="shrink-0 self-center rounded-lg bg-black/[0.05] px-2 py-1 text-[10px] font-medium text-foreground-secondary hover:bg-black/[0.1] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
              >
                Review
              </button>
            </div>
          )}

          {insights.isEmpty && (
            <div className="rounded-2xl border border-dashed border-border p-4 text-center text-[11.5px] text-foreground-secondary">
              Workspace is empty — a good place to start.
            </div>
          )}
        </div>

        {/* activity feed */}
        <div className="space-y-2.5">
          <p className="px-1 text-[10.5px] font-semibold uppercase tracking-wide text-foreground-secondary/70">Recent activity</p>
          <div className="rounded-2xl border border-border bg-background-secondary p-1.5">
            {activity.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 p-6 text-center text-foreground-secondary">
                <Squirrel size={20} className="opacity-40" />
                <p className="text-[11px]">Nothing's happened yet — go make something.</p>
              </div>
            ) : (
              activity.map((e) => (
                <button
                  key={`${e.kind}-${e.id}`}
                  onClick={() => (e.kind === "community" ? openApp("community", openWindow) : openNode({ id: e.id, type: e.kind }))}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    {e.kind === "folder" ? <Folder size={12} /> : e.kind === "community" ? <Megaphone size={12} /> : <File size={12} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px]">{e.label}</p>
                    {e.detail && <p className="truncate text-[10px] text-foreground-secondary">{e.detail}</p>}
                  </div>
                  <span className="shrink-0 text-[10px] text-foreground-secondary/60">{timeAgo(e.at)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => onAskSteve?.()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-[12px] text-foreground-secondary transition-colors hover:border-accent/40 hover:text-accent"
      >
        Or just tell Steve what you need <ArrowRight size={13} />
      </button>
    </div>
  );
}