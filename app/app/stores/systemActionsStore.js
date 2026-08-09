import { create } from "zustand";
import { useWindowStore } from "./useWindowStore";
import { useFileSystemStore } from "./useFileSystemStore";
import { getApp } from "@/app/lib/appRegistry";

let runCounter = 0;
const nextRunId = () => `run-${Date.now()}-${runCounter++}`;

// Describes every runnable action, its human label, description, and
// expected params shape (used for the ToolConsole UI hint chips; runAction
// doesn't enforce types beyond what the backend itself validates).
export const ACTIONS = [
  {
    id: "openApp",
    label: "Open App",
    description: "Opens an app window by its registry id.",
    paramsSchema: { appId: "string" },
  },
  {
    id: "createFolder",
    label: "Create Folder",
    description: "Creates a new folder under a parent (or root if omitted).",
    paramsSchema: { parentId: "string | null", name: "string" },
  },
  {
    id: "createFile",
    label: "Create File",
    description: "Creates a new file with optional starting content.",
    paramsSchema: { parentId: "string | null", name: "string", content: "string?" },
  },
  {
    id: "renameNode",
    label: "Rename Node",
    description: "Renames an existing file or folder.",
    paramsSchema: { id: "string", name: "string" },
  },
  {
    id: "moveNode",
    label: "Move Node",
    description: "Moves a node to a new parent folder.",
    paramsSchema: { id: "string", newParentId: "string | null" },
  },
  {
    id: "duplicateNode",
    label: "Duplicate Node",
    description: "Duplicates a file or folder.",
    paramsSchema: { id: "string" },
  },
  {
    id: "trashNode",
    label: "Trash Node",
    description: "Moves a node (and its subtree) to trash.",
    paramsSchema: { id: "string" },
  },
  {
    id: "restoreNode",
    label: "Restore Node",
    description: "Restores a node out of trash.",
    paramsSchema: { id: "string" },
  },
  {
    id: "deleteForever",
    label: "Delete Forever",
    description: "Permanently deletes a node and its subtree.",
    paramsSchema: { id: "string" },
  },
  {
    id: "emptyTrash",
    label: "Empty Trash",
    description: "Permanently deletes every trashed item.",
    paramsSchema: {},
  },
  {
    id: "searchNodes",
    label: "Search Nodes",
    description: "Searches non-trashed items by name.",
    paramsSchema: { query: "string" },
  },
  {
    id: "getWorkspaceStats",
    label: "Workspace Stats",
    description: "Returns file/folder counts across the workspace.",
    paramsSchema: {},
  },
  {
    id: "openPath",
    label: "Open Path",
    description: 'Opens Files at a specific folder path, e.g. "Documents/Projects".',
    paramsSchema: { path: "string" },
  },
  {
    id: "listFolder",
    label: "List Folder",
    description: 'Lists the contents of a folder by path (use "" or "/" for the workspace root).',
    paramsSchema: { path: "string?" },
  },
];

// Every branch that touches useFileSystemStore now awaits a real network
// call, so this whole dispatcher is async. Failures from the API (bad
// request, not found, etc.) are caught here and turned into the same
// { ok: false, message } shape the console/AI assistant already expect,
// rather than throwing and blowing up the caller.
async function executeAction(actionId, payload) {
  try {
    switch (actionId) {
      case "openApp": {
        const app = getApp(payload.appId);
        if (!app) return { ok: false, message: `Unknown app: ${payload.appId}` };
        if (app.comingSoon || !app.component)
          return { ok: false, message: `${app.title} isn't available yet.` };

        useWindowStore.getState().openWindow({
          id: app.id,
          title: app.title,
          content: <app.component />,
          width: app.width,
          height: app.height,
          minWidth: app.minWidth,
          minHeight: app.minHeight,
        });
        return { ok: true, message: `Opened ${app.title}` };
      }

      case "createFolder": {
        if (!payload.name) return { ok: false, message: "`name` is required" };
        const id = await useFileSystemStore
          .getState()
          .createFolder(payload.parentId ?? null, payload.name);
        return { ok: true, message: `Created folder "${payload.name}"`, id };
      }

      case "createFile": {
        if (!payload.name) return { ok: false, message: "`name` is required" };
        const id = await useFileSystemStore
          .getState()
          .createFile(payload.parentId ?? null, payload.name, payload.content ?? "");
        return { ok: true, message: `Created file "${payload.name}"`, id };
      }

      case "renameNode": {
        if (!payload.id || !payload.name) return { ok: false, message: "`id` and `name` are required" };
        await useFileSystemStore.getState().renameNode(payload.id, payload.name);
        return { ok: true, message: `Renamed ${payload.id} to "${payload.name}"` };
      }

      case "moveNode": {
        if (!payload.id) return { ok: false, message: "`id` is required" };
        await useFileSystemStore.getState().moveNode(payload.id, payload.newParentId ?? null);
        return { ok: true, message: `Moved ${payload.id}` };
      }

      case "duplicateNode": {
        if (!payload.id) return { ok: false, message: "`id` is required" };
        await useFileSystemStore.getState().duplicateNode(payload.id);
        return { ok: true, message: `Duplicated ${payload.id}` };
      }

      case "trashNode": {
        if (!payload.id) return { ok: false, message: "`id` is required" };
        await useFileSystemStore.getState().trashNode(payload.id);
        return { ok: true, message: `Trashed ${payload.id}` };
      }

      case "restoreNode": {
        if (!payload.id) return { ok: false, message: "`id` is required" };
        await useFileSystemStore.getState().restoreNode(payload.id);
        return { ok: true, message: `Restored ${payload.id}` };
      }

      case "deleteForever": {
        if (!payload.id) return { ok: false, message: "`id` is required" };
        await useFileSystemStore.getState().deleteForever(payload.id);
        return { ok: true, message: `Permanently deleted ${payload.id}` };
      }

      case "emptyTrash": {
        await useFileSystemStore.getState().emptyTrash();
        return { ok: true, message: "Trash emptied" };
      }

      case "searchNodes": {
        const results = useFileSystemStore.getState().searchNodes(payload.query ?? "");
        return {
          ok: true,
          message: `${results.length} match(es)`,
          results: results.map((n) => ({ id: n.id, name: n.name, type: n.type })),
        };
      }

      case "getWorkspaceStats": {
        const items = Object.values(useFileSystemStore.getState().items).filter((n) => !n.trashed);
        return {
          ok: true,
          fileCount: items.filter((n) => n.type === "file").length,
          folderCount: items.filter((n) => n.type === "folder").length,
        };
      }

      case "openPath": {
        const raw = (payload.path ?? "").trim();
        const fs = useFileSystemStore.getState();
        let folderId = null;
        if (raw && raw !== "/") {
          const { folderId: id, found, missingSegment } = fs.resolvePath(raw);
          if (!found) return { ok: false, message: `No folder named "${missingSegment}" there.` };
          folderId = id;
        }
        const app = getApp("files");
        useWindowStore.getState().openWindow({
          id: app.id,
          title: app.title,
          content: <app.component initialFolderId={folderId} />,
          width: app.width,
          height: app.height,
          minWidth: app.minWidth,
          minHeight: app.minHeight,
        });
        return { ok: true, message: raw ? `Opened "${raw}" in Files.` : "Opened Files at the workspace root." };
      }

      case "listFolder": {
        const raw = (payload.path ?? "").trim();
        const fs = useFileSystemStore.getState();
        let folderId = null;
        if (raw && raw !== "/") {
          const { folderId: id, found, missingSegment } = fs.resolvePath(raw);
          if (!found) return { ok: false, message: `No folder named "${missingSegment}" there.` };
          folderId = id;
        }
        const children = fs.getChildren(folderId);
        return {
          ok: true,
          message: `${children.length} item(s) in ${raw || "workspace root"}`,
          items: children.map((n) => ({ id: n.id, name: n.name, type: n.type })),
        };
      }

      default:
        return { ok: false, message: `Unknown action: ${actionId}` };
    }
  } catch (err) {
    return { ok: false, message: err.response?.data?.message || err.message || "Action failed" };
  }
}

export const useSystemActionsStore = create((set) => ({
  actions: ACTIONS,
  history: [],

  runAction: async (actionId, payload = {}) => {
    const result = await executeAction(actionId, payload);

    set((s) => ({
      history: [
        { runId: nextRunId(), actionId, params: payload, result, timestamp: Date.now() },
        ...s.history,
      ].slice(0, 50), // cap history so it doesn't grow unbounded
    }));

    return result;
  },

  clearHistory: () => set({ history: [] }),
}));
