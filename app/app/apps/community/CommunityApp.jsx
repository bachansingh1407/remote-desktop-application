"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  PenSquare,
  Send,
  Loader2,
  X,
  Trash2,
  RefreshCw,
  Radio,
  Pin,
  Terminal,
  MessageSquareText,
} from "lucide-react";
import { useCommunityStore } from "@/app/stores/useCommunityStore";
import { useAuthStore } from "@/app/stores/useAuthStore";
import { useSteveStore } from "@/app/stores/useSteveStore";

// ---------------------------------------------------------------------------
// EDIT THIS — pinned notes from the creator. Always shown in the right
// rail, above every visitor post, regardless of search/pagination. Not
// stored in the database; a plain array here. Add more any time — no
// migration, no API call, just redeploy.
//
// `paragraphs` is an array on purpose (not one big string with blank
// lines) — it renders each as its own <p>, so spacing stays clean and
// predictable no matter how the text is written or edited later.
// ---------------------------------------------------------------------------
const DEVELOPER_NOTES = [
  {
    name: "Bachan Singh",
    role: "Creator of Campus",
    date: "Ongoing",
    paragraphs: [
      "I built this space because a project feels different when other people get to explore it, question it, and leave their own perspective behind.",
      "Take a look around. Try things, notice the details, tell me what feels interesting, what feels unnecessary, or what you would build differently.",
      "You don't need to have a perfect idea or a long message. If something crossed your mind while exploring, share it here.",
      "This wall is for your thoughts as much as it is for mine.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Visual system — soft, colorful avatar tags derived deterministically from
// each visitor's name, so the same person always looks the same instead of
// re-rolling on every render.
// ---------------------------------------------------------------------------
const TAG_COLORS = [
  "#F59E0B", // amber
  "#10B981", // emerald
  "#38BDF8", // sky
  "#F472B6", // pink
  "#A78BFA", // violet
  "#FB923C", // orange
  "#34D399", // teal
  "#F87171", // rose
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function tagColorFor(seed) {
  return TAG_COLORS[hashString(seed) % TAG_COLORS.length];
}

function initialsOf(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const NAME_LIMIT = 40;
const MESSAGE_LIMIT = 500;

// ---------------------------------------------------------------------------
// Composer — a focused modal so both fields get real room, instead of a
// squeezed inline row. Styling now matches the rest of Campus's modals:
// rounded-2xl, 1px border, soft shadow — not a separate visual language.
// ---------------------------------------------------------------------------
function ComposerModal({ defaultName, onClose }) {
  const addPost = useCommunityStore((s) => s.addPost);
  const isPosting = useCommunityStore((s) => s.isPosting);
  const error = useCommunityStore((s) => s.error);

  const [name, setName] = useState(defaultName || "");
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const messageRef = useRef(null);

  useEffect(() => {
    (name ? messageRef.current : null)?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canPost = name.trim().length > 0 && message.trim().length > 0 && !isPosting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canPost) return;
    setLocalError("");
    const result = await addPost(name, message);
    if (result.ok) {
      if (typeof window !== "undefined") localStorage.setItem("community:lastName", name.trim());
      useSteveStore.getState().unlock("community_voice");
      onClose();
    } else {
      setLocalError(result.error);
    }
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md animate-[modal-in_0.18s_ease-out] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <PenSquare size={15} />
            </span>
            <span className="text-sm font-semibold">Share your thoughts</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground-secondary transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 p-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-foreground-secondary">Your name</label>
            <input
              autoFocus={!name}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, NAME_LIMIT))}
              placeholder="e.g. Bachan"
              className="w-full rounded-xl border border-border bg-background-secondary px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-[11px] font-medium text-foreground-secondary">Your message</label>
              <span className="text-[10.5px] text-foreground-secondary/70">
                {message.length}/{MESSAGE_LIMIT}
              </span>
            </div>
            <textarea
              ref={messageRef}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_LIMIT))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
              }}
              placeholder="Feedback, an idea, a suggestion, a shout-out — anything goes."
              rows={6}
              className="w-full resize-y rounded-xl border border-border bg-background-secondary px-3.5 py-3 text-sm leading-relaxed outline-none transition-shadow focus:ring-2 focus:ring-accent/40"
              style={{ minHeight: "130px" }}
            />
          </div>

          {(localError || error) && <p className="text-[11.5px] text-red-500">{localError || error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <span className="text-[10.5px] text-foreground-secondary/70">⌘/Ctrl + Enter to post</span>
          <button
            type="submit"
            disabled={!canPost}
            className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-[12.5px] font-semibold text-white transition-all ${
              canPost ? "bg-accent hover:brightness-110 active:scale-95" : "cursor-not-allowed bg-accent/40"
            }`}
          >
            {isPosting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Post it
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CommunityApp() {
  const posts = useCommunityStore((s) => s.posts);
  const nextCursor = useCommunityStore((s) => s.nextCursor);
  const isLoading = useCommunityStore((s) => s.isLoading);
  const freshIds = useCommunityStore((s) => s.freshIds);
  const fetchPosts = useCommunityStore((s) => s.fetchPosts);
  const loadMore = useCommunityStore((s) => s.loadMore);
  const removePost = useCommunityStore((s) => s.removePost);
  const currentUser = useAuthStore((s) => s.user);

  const [savedName, setSavedName] = useState("");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    fetchPosts();
    const stored = typeof window !== "undefined" ? localStorage.getItem("community:lastName") : "";
    if (stored) setSavedName(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => p.name.toLowerCase().includes(q) || p.message.toLowerCase().includes(q));
  }, [posts, query]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground">
      {composerOpen && <ComposerModal defaultName={savedName} onClose={() => setComposerOpen(false)} />}

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_300px]">
        {/* ── LEFT: Guestbook ─────────────────────────────────────── */}
        <div className="flex min-h-0 min-w-0 flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-background-secondary/60 px-5 py-3.5">
            <div className="relative min-w-[140px] flex-1 sm:flex-none">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 pl-8 text-[12px] outline-none transition-shadow focus:ring-2 focus:ring-accent/30 sm:w-44"
              />
            </div>

            <button
              onClick={() => setComposerOpen(true)}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition-transform hover:brightness-110 active:scale-95"
            >
              <PenSquare size={13} />
              Share thoughts
            </button>

            <button
              onClick={() => fetchPosts()}
              disabled={isLoading}
              title="Refresh"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-foreground-secondary transition-colors hover:bg-black/[0.05] disabled:opacity-50 dark:hover:bg-white/[0.06]"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {filtered.length === 0 && !isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-foreground-secondary">
                <MessageSquareText size={26} className="opacity-40" />
                <p className="text-sm font-medium">{query ? `Nothing matches "${query}"` : "The wall is empty"}</p>
                {!query && <p className="text-xs">Be the first to pin something.</p>}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {isLoading && posts.length === 0 &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`sk-${i}`} className="h-[76px] animate-pulse rounded-2xl bg-black/[0.05] dark:bg-white/[0.05]" />
                  ))}

                {filtered.map((post) => {
                  const color = tagColorFor(post.name || post.id);
                  const isMine = currentUser && post.authorId === currentUser.id;
                  const isFresh = freshIds.has(post.id);

                  return (
                    <div
                      key={post.id}
                      className={`group relative rounded-2xl border border-border bg-background-secondary p-3.5 transition-all hover:border-accent/40 hover:shadow-sm ${
                        isFresh ? "animate-[entry-in_0.4s_ease-out]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: color }}
                        >
                          {initialsOf(post.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-start flex-col">
                            <span className="truncate text-[13px] font-semibold">{post.name}</span>
                            <span className="shrink-0 text-[10.5px] text-foreground-secondary/70">{timeAgo(post.createdAt)}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-foreground-secondary">
                            {post.message}
                          </p>
                        </div>
                      </div>

                      {isMine && (
                        <button
                          onClick={() => removePost(post.id)}
                          title="Remove your post"
                          className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-foreground-secondary opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {nextCursor && !query && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="rounded-xl border border-border px-4 py-1.5 text-xs text-foreground-secondary transition-colors hover:bg-black/[0.05] disabled:opacity-50 dark:hover:bg-white/[0.06]"
                >
                  {isLoading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Developer's Message (always visible) ───────────── */}
        <div className="flex min-h-0 min-w-0 flex-col bg-background-secondary/40">
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background-secondary/60 px-5 py-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Terminal size={15} />
            </div>
            <span className="text-[12.5px] font-semibold">Developer's Message</span>
            <span className="ml-auto flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide text-emerald-500">
              <Radio size={10} className="animate-pulse" />
              live
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {DEVELOPER_NOTES.map((note, i) => {
              const color = tagColorFor(note.name);
              return (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-background to-background p-4 shadow-sm"
                >
                  <div
                    className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl"
                    style={{ background: "var(--accent)" }}
                  />

                  <div className="relative flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-md"
                      style={{ backgroundColor: color }}
                    >
                      {initialsOf(note.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold leading-tight">{note.name}</span>
                        <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                          <Pin size={9} />
                          Pinned
                        </span>
                      </div>
                      <p className="text-[10.5px] text-foreground-secondary">{note.role}</p>
                    </div>
                  </div>

                  <div className="relative mt-3 space-y-2.5">
                    {note.paragraphs.map((para, pi) => (
                      <p key={pi} className="text-[12.5px] leading-[1.75] text-foreground-secondary">
                        {para}
                      </p>
                    ))}
                  </div>

                  <p className="relative mt-3 border-t border-border/60 pt-2 text-[10px] text-foreground-secondary/60">
                    {note.date}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes entry-in {
          0% {
            opacity: 0;
            transform: translateY(-8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes modal-in {
          0% {
            opacity: 0;
            transform: scale(0.96) translateY(6px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
} 