import { create } from "zustand";
import api from "../lib/axios";

// Root-level items have parentId === null on both client and server —
// this is just a named alias for that, kept for readability at call sites
// and because the old index.js already re-exported it.
export const ROOT_ID = null;

/**
 * ARCHITECTURE NOTE — why this store still looks like an in-memory mock:
 *
 * Every component built against the old mock store (FilesApp, TrashApp,
 * FileEditor, SettingsApp, the AI assistant, ToolConsole...) reads the
 * tree SYNCHRONOUSLY: `items[id]`, `Object.values(items)`, `getChildren()`.
 * A real backend is naturally lazy/paginated per folder, which would mean
 * rewriting every one of those call sites to handle loading states.
 *
 * Instead, this store hydrates the ENTIRE tree into the same `items` map
 * shape once (on login), so every existing synchronous read keeps working
 * unmodified. Mutations hit the real API, then patch the local cache from
 * the server's response — so the cache never drifts from server truth for
 * single-tab, single-user usage. `restoreNode` is the one exception: its
 * cascade logic is genuinely nontrivial to replicate client-side, so it
 * just re-hydrates from the server after the call succeeds.
 *
 * This is a deliberate simplification for a personal-workspace-scale app,
 * not a general pattern — if this ever needs multi-tab sync or thousands
 * of nodes, switch to lazy per-folder fetches (the backend already
 * supports that via GET /nodes?parentId=) and add loading states to the
 * consuming components.
 */

function normalizeNode(n) {
  return {
    ...n,
    // Server sends the Prisma enum ("FOLDER" | "FILE"); every existing
    // component compares against the mock's original lowercase strings.
    type: n.type.toLowerCase(),
    // `imported` distinguishes an uploaded binary file (has storagePath)
    // from a plain text note (has `content`) — same flag the mock used.
    imported: !!n.storagePath,
    createdAt: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
    updatedAt: n.updatedAt ? new Date(n.updatedAt).getTime() : Date.now(),
    trashedAt: n.trashedAt ? new Date(n.trashedAt).getTime() : null,
  };
}

function collectSubtreeLocal(items, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of Object.values(items)) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    }
  }
  return ids;
}

export const useFileSystemStore = create((set, get) => ({
  items: {},
  isHydrated: false,
  isHydrating: false,
  error: null,

  /** Fetches the whole workspace tree in one call and seeds the cache.
   * Called once after login (see Providers) and again after restoreNode. */
  hydrate: async () => {
    set({ isHydrating: true, error: null });
    try {
      const { data } = await api.get("/nodes/tree");
      const items = {};
      for (const raw of data.data.items) {
        const node = normalizeNode(raw);
        items[node.id] = node;
      }
      set({ items, isHydrated: true });
    } catch (err) {
      set({ error: err.response?.data?.message || "Failed to load workspace" });
    } finally {
      set({ isHydrating: false });
    }
  },

  clearCache: () => set({ items: {}, isHydrated: false }),

  createFolder: async (parentId, name) => {
    const { data } = await api.post("/nodes/folder", { parentId, name });
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [node.id]: node } }));
    return node.id;
  },

  createFile: async (parentId, name, content = "") => {
    const { data } = await api.post("/nodes/file", { parentId, name, content });
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [node.id]: node } }));
    return node.id;
  },

  importFile: async (parentId, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("parentId", parentId ?? "null");

    const { data } = await api.post("/nodes/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [node.id]: node } }));
    return node.id;
  },

  updateFileContent: async (id, content) => {
    const { data } = await api.patch(`/nodes/${id}/content`, { content });
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [id]: node } }));
  },

  renameNode: async (id, name) => {
    const { data } = await api.patch(`/nodes/${id}/rename`, { name });
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [id]: node } }));
  },

  moveNode: async (id, newParentId) => {
    const { data } = await api.patch(`/nodes/${id}/move`, { newParentId });
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [id]: node } }));
  },

  duplicateNode: async (id) => {
    const { data } = await api.post(`/nodes/${id}/duplicate`);
    const node = normalizeNode(data.data.node);
    set((s) => ({ items: { ...s.items, [node.id]: node } }));
    return node.id;
  },

  trashNode: async (id) => {
    await api.post(`/nodes/${id}/trash`);
    // Backend cascades the whole subtree; mirror that locally rather than
    // re-fetching, using the same subtree walk the mock used to use.
    set((s) => {
      const subtree = collectSubtreeLocal(s.items, id);
      const next = { ...s.items };
      const now = Date.now();
      subtree.forEach((nid) => {
        next[nid] = {
          ...next[nid],
          trashed: true,
          trashedAt: now,
          originalParentId: next[nid].originalParentId ?? next[nid].parentId,
        };
      });
      return { items: next };
    });
  },

  /** Restore's cascade rules (does a descendant come back with it? does
   * the root reattach to its old parent or fall back to root?) live in
   * the backend and are non-trivial to mirror correctly client-side, so
   * this just re-hydrates the whole tree from server truth afterward. */
  restoreNode: async (id) => {
    await api.post(`/nodes/${id}/restore`);
    await get().hydrate();
  },

  deleteForever: async (id) => {
    await api.delete(`/nodes/${id}`);
    set((s) => {
      const subtree = collectSubtreeLocal(s.items, id);
      const next = { ...s.items };
      subtree.forEach((nid) => delete next[nid]);
      return { items: next };
    });
  },

  emptyTrash: async () => {
    await api.delete("/nodes/trash/empty");
    set((s) => {
      const next = { ...s.items };
      Object.values(s.items).forEach((n) => {
        if (n.trashed) delete next[n.id];
      });
      return { items: next };
    });
  },

  /** Wipes the entire workspace — trash every live root item (cascades
   * through everything beneath it), then empty the trash, which also
   * sweeps up anything that was already sitting in trash beforehand. */
  resetFileSystem: async () => {
    const { items } = get();
    const liveRootItems = Object.values(items).filter((n) => !n.parentId && !n.trashed);
    await Promise.all(liveRootItems.map((n) => api.post(`/nodes/${n.id}/trash`)));
    await api.delete("/nodes/trash/empty");
    set({ items: {} });
  },

  searchNodes: (query) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return Object.values(get().items).filter((n) => !n.trashed && n.name.toLowerCase().includes(q));
  },

  getChildren: (parentId) =>
    Object.values(get().items).filter((n) => n.parentId === parentId && !n.trashed),

  getTrashedNodes: () => Object.values(get().items).filter((n) => n.trashed),

  getPath: (id) => {
    const items = get().items;
    const path = [];
    let cur = id ? items[id] : null;
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? items[cur.parentId] : null;
    }
    return path;
  },

  // Resolves a "/"-separated path (e.g. "Documents/Projects") to a folder
  // id, walking from the workspace root and matching names case-insensitively
  // at each level. Returns { folderId, found, resolvedSegments, missingSegment }
  // so callers (AI assistant, tool console) can give a precise error instead
  // of a generic "not found".
  resolvePath: (pathStr) => {
    const segments = String(pathStr).split("/").map((s) => s.trim()).filter(Boolean);
    let parentId = null;
    const resolvedSegments = [];
    for (const seg of segments) {
      const children = get().getChildren(parentId);
      const match = children.find((n) => n.type === "folder" && n.name.toLowerCase() === seg.toLowerCase());
      if (!match) return { folderId: null, found: false, resolvedSegments, missingSegment: seg };
      parentId = match.id;
      resolvedSegments.push(match.name);
    }
    return { folderId: parentId, found: true, resolvedSegments, missingSegment: null };
  },
}));
