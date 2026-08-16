import { useFileSystemStore } from "@/app/stores/useFileSystemStore";
import { useCommunityStore } from "@/app/stores/useCommunityStore";
import { APP_REGISTRY } from "@/app/lib/appRegistry";

export const LAST_SEEN_KEY = "steve:lastSeenAt";

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function timeAgo(iso) {
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

/**
 * Workspace health — file/folder counts, storage used, largest files, and
 * "clutter" signals (default-named notes nobody's renamed, trash sitting
 * around). Reads directly from the already-hydrated file tree, so this is
 * free — no extra network calls.
 */
export function computeInsights() {
  const items = Object.values(useFileSystemStore.getState().items ?? {});
  const active = items.filter((n) => !n.trashed);
  const files = active.filter((n) => n.type === "file");
  const folders = active.filter((n) => n.type === "folder");
  const trashed = items.filter((n) => n.trashed);

  const totalSizeBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const largestFiles = [...files]
    .filter((f) => (f.size || 0) > 0)
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, 3);

  // Matches the actual default names Campus gives new items — "Untitled",
  // "Untitled document", "Untitled snippet" — so this only flags things
  // nobody's ever renamed, not anything with "untitled" incidentally in it.
  const untitledItems = active.filter((n) => /^untitled/i.test(n.name.trim()));

  let oldestTrashedDays = 0;
  if (trashed.length) {
    const oldest = trashed.reduce((acc, n) => (!acc || new Date(n.trashedAt) < new Date(acc.trashedAt) ? n : acc), null);
    if (oldest?.trashedAt) {
      oldestTrashedDays = Math.floor((Date.now() - new Date(oldest.trashedAt).getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  return {
    fileCount: files.length,
    folderCount: folders.length,
    totalSizeBytes,
    largestFiles,
    untitledItems,
    trashedCount: trashed.length,
    oldestTrashedDays,
    isEmpty: files.length + folders.length === 0,
  };
}

/**
 * Everything that's happened recently, merged from two independent
 * sources (the file tree and the Community store) into one timeline.
 * Community posts aren't fetched here — the Home screen triggers that
 * fetch itself on mount, same as the Community app does.
 */
export function computeActivityFeed(limit = 6) {
  const nodes = Object.values(useFileSystemStore.getState().items ?? {}).filter((n) => !n.trashed);
  const posts = useCommunityStore.getState().posts ?? [];

  const nodeEvents = nodes.map((n) => ({
    kind: n.type === "folder" ? "folder" : "file",
    id: n.id,
    label: n.name,
    at: n.updatedAt || n.createdAt,
    isNew: !n.updatedAt || n.updatedAt === n.createdAt,
  }));

  const postEvents = posts.map((p) => ({
    kind: "community",
    id: p.id,
    label: `${p.name} pinned something`,
    detail: p.message,
    at: p.createdAt,
  }));

  return [...nodeEvents, ...postEvents]
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

/**
 * "Since you were last here" — compares against the same lastSeenAt
 * timestamp the floating widget already tracks, so the two surfaces
 * always agree on what counts as "new."
 */
export function computeSessionBriefing() {
  const lastSeenRaw = typeof window !== "undefined" ? localStorage.getItem(LAST_SEEN_KEY) : null;
  const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : null;

  const nodes = Object.values(useFileSystemStore.getState().items ?? {}).filter((n) => !n.trashed);
  const posts = useCommunityStore.getState().posts ?? [];
  const insights = computeInsights();

  const newPosts = lastSeen ? posts.filter((p) => new Date(p.createdAt).getTime() > lastSeen).length : 0;
  const touchedFiles = lastSeen
    ? nodes.filter((n) => new Date(n.updatedAt || n.createdAt).getTime() > lastSeen).length
    : 0;

  const parts = [];
  if (touchedFiles > 0) parts.push(`${touchedFiles} file${touchedFiles === 1 ? "" : "s"} touched`);
  if (newPosts > 0) parts.push(`${newPosts} new Community post${newPosts === 1 ? "" : "s"}`);
  if (insights.trashedCount > 0) parts.push(`${insights.trashedCount} item${insights.trashedCount === 1 ? "" : "s"} in Trash`);

  return { hasNews: parts.length > 0, summary: parts.join(" · "), newPosts, touchedFiles };
}

/** A rough single number for the widget's notification badge. */
export function computeNotificationCount() {
  const insights = computeInsights();
  const briefing = computeSessionBriefing();
  let count = 0;
  if (insights.trashedCount > 0) count += 1;
  if (insights.untitledItems.length >= 2) count += 1;
  if (briefing.newPosts > 0) count += 1;
  return count;
}

/** Universal search across apps, files/folders, and Community posts. */
export function computeSearchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) return { apps: [], nodes: [], posts: [] };

  const apps = APP_REGISTRY.filter((a) => !a.comingSoon && a.title.toLowerCase().includes(q)).slice(0, 4);

  const nodes = Object.values(useFileSystemStore.getState().items ?? {})
    .filter((n) => !n.trashed && n.name.toLowerCase().includes(q))
    .slice(0, 5);

  const posts = (useCommunityStore.getState().posts ?? [])
    .filter((p) => p.name.toLowerCase().includes(q) || p.message.toLowerCase().includes(q))
    .slice(0, 3);

  return { apps, nodes, posts };
}