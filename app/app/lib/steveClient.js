import api from "@/app/lib/axios";
import { useSystemActionsStore } from "@/app/stores/systemActionsStore";
import { useFileSystemStore } from "@/app/stores/useFileSystemStore";

// ---------------------------------------------------------------------------
// Executes a single tool call Groq asked for, using the SAME action
// dispatcher the rest of Campus already trusts (systemActionsStore) —
// nothing here duplicates file-system logic. Path-based args (parentPath)
// get resolved to real node ids via the file system store's existing
// resolvePath, exactly like the Tool Console does.
// ---------------------------------------------------------------------------
async function executeToolCall(call) {
  const { runAction } = useSystemActionsStore.getState();
  const fs = useFileSystemStore.getState();

  let args = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    args = {};
  }

  const resolveParent = (parentPath) => {
    if (!parentPath) return { ok: true, parentId: null };
    const { folderId, found, missingSegment } = fs.resolvePath(parentPath);
    if (!found) return { ok: false, message: `No folder named "${missingSegment}" there.` };
    return { ok: true, parentId: folderId };
  };

  const findByName = async (name) => {
    const found = await runAction("searchNodes", { query: name });
    if (!found.ok) return null;
    return found.results.find((n) => n.name.toLowerCase() === name.toLowerCase()) ?? found.results[0] ?? null;
  };

  switch (call.function.name) {
    case "open_app": {
      const result = await runAction("openApp", { appId: args.appId });
      return { content: result.message };
    }

    case "create_folder": {
      const parent = resolveParent(args.parentPath);
      if (!parent.ok) return { content: parent.message };
      const result = await runAction("createFolder", { parentId: parent.parentId, name: args.name });
      return {
        content: result.message,
        fileRef: result.ok ? { type: "folder", id: result.id, name: args.name } : null,
      };
    }

    case "create_note": {
      const parent = resolveParent(args.parentPath);
      if (!parent.ok) return { content: parent.message };
      const result = await runAction("createFile", { parentId: parent.parentId, name: args.name, content: "" });
      return {
        content: result.message,
        fileRef: result.ok ? { type: "file", id: result.id, name: args.name } : null,
      };
    }

    case "list_folder": {
      const result = await runAction("listFolder", { path: args.path ?? "" });
      if (!result.ok) return { content: result.message };
      const names = result.items.map((n) => (n.type === "folder" ? `${n.name}/` : n.name));
      return { content: `${result.message}: ${names.join(", ") || "(empty)"}` };
    }

    case "search_workspace": {
      const result = await runAction("searchNodes", { query: args.query });
      if (!result.ok) return { content: result.message };
      const names = result.results.map((n) => n.name);
      return { content: `${result.message}: ${names.join(", ") || "none"}` };
    }

    case "rename_item": {
      const target = await findByName(args.fromName);
      if (!target) return { content: `Couldn't find anything named "${args.fromName}".` };
      const result = await runAction("renameNode", { id: target.id, name: args.toName });
      return { content: result.message };
    }

    case "trash_item": {
      const target = await findByName(args.name);
      if (!target) return { content: `Couldn't find anything named "${args.name}".` };
      const result = await runAction("trashNode", { id: target.id });
      return { content: result.message };
    }

    case "workspace_stats": {
      const result = await runAction("getWorkspaceStats", {});
      return {
        content: result.ok
          ? `${result.fileCount} file(s), ${result.folderCount} folder(s) in the workspace.`
          : "Couldn't read workspace stats right now.",
      };
    }

    default:
      return { content: `Steve doesn't have a "${call.function.name}" tool.` };
  }
}

/**
 * Runs one full turn: sends `history` (OpenAI-format messages, no system
 * message — the backend owns that) to Steve's backend endpoint. If Groq
 * asks for tool calls, executes them all locally and sends a follow-up
 * request with the results so Steve can give a real final answer that
 * references what actually happened.
 *
 * Returns every raw message generated this turn (assistant tool-call
 * message, tool result messages, final assistant message) so the caller
 * can both render it and keep it in the running history for next turn's
 * context — plus a flat list of any fileRefs produced, for clickable
 * chips in the UI.
 */
export async function sendToSteve(history) {
  const first = await api.post("/steve/chat", { messages: history });
  const firstMsg = first.data.data.message;

  if (!firstMsg.tool_calls?.length) {
    return { messages: [firstMsg], fileRefs: [] };
  }

  const toolResultMessages = [];
  const fileRefs = [];

  for (const call of firstMsg.tool_calls) {
    const { content, fileRef } = await executeToolCall(call);
    toolResultMessages.push({
      role: "tool",
      tool_call_id: call.id,
      name: call.function.name,
      content: content ?? "",
    });
    if (fileRef) fileRefs.push(fileRef);
  }

  const followUp = [...history, firstMsg, ...toolResultMessages];
  const second = await api.post("/steve/chat", { messages: followUp });
  const finalMsg = second.data.data.message;

  return { messages: [firstMsg, ...toolResultMessages, finalMsg], fileRefs };
}
