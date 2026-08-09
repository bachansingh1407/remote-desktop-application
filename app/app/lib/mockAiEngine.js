import { useSystemActionsStore } from "@/app/stores/systemActionsStore";
import { APP_REGISTRY } from "@/app/lib/appRegistry";

// A small, transparent set of regex-matched commands rather than a real
// model — see ai-assistant/AIAssistantApp.jsx's help panel for the
// user-facing command list that mirrors what's actually handled below.
export async function getAIResponse({ message }) {
  const runAction = useSystemActionsStore.getState().runAction;
  const text = message.trim().toLowerCase();

  await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));

  // ── help ──────────────────────────────────────────────────────────
  if (/^(help|what can you do|commands?)\??$/.test(text)) {
    return {
      text:
        "Here's what I can do right now: open apps (\"open files\"), navigate to a folder by path " +
        "(\"open folder Documents/Projects\"), list what's in a folder (\"what's in Documents\"), create " +
        "folders and notes, search your workspace, rename or trash items by name, and summarize your " +
        "workspace. Tap the ? button above for the full list with examples.",
    };
  }

  // ── open a folder by path ────────────────────────────────────────
  // "open folder Documents/Projects", "go to Documents", "navigate to /"
  const pathMatch = text.match(/^(?:open folder|open path|go to|navigate to)\s+(.+)$/);
  if (pathMatch) {
    const path = pathMatch[1].trim().replace(/^["']|["']$/g, "");
    const result = await runAction("openPath", { path });
    return { text: result.ok ? result.message : `I couldn't find that: ${result.message}` };
  }

  // ── list a folder's contents ─────────────────────────────────────
  // "what's in Documents", "list Documents/Projects", "show me the contents of Documents"
  const listMatch = text.match(/^(?:what'?s in|list|show (?:me )?(?:the )?contents? of)\s+(.+)$/);
  if (listMatch) {
    const path = listMatch[1].trim().replace(/^["']|["']$/g, "").replace(/^my /, "");
    const result = await runAction("listFolder", { path });
    if (!result.ok) return { text: `I couldn't find that: ${result.message}` };
    if (result.items.length === 0) return { text: `"${path}" is empty.` };
    const names = result.items.slice(0, 12).map((n) => (n.type === "folder" ? `${n.name}/` : n.name));
    return { text: `In "${path}": ${names.join(", ")}${result.items.length > 12 ? ", ..." : ""}` };
  }

  // ── open an app ───────────────────────────────────────────────────
  const openAppMatch = text.match(/^open (\w[\w\s]*)/);
  if (openAppMatch) {
    const query = openAppMatch[1].trim();
    const app = APP_REGISTRY.find((a) => a.title.toLowerCase().includes(query) || query.includes(a.title.toLowerCase()));
    if (app) {
      const result = await runAction("openApp", { appId: app.id });
      return { text: result.ok ? `Opening ${app.title} for you.` : `Couldn't open ${app.title}: ${result.message}` };
    }
  }

  // ── create a folder ───────────────────────────────────────────────
  const folderMatch = text.match(/(?:create|make|new) a?\s*folder (?:called|named)?\s*"?([^"]+)"?$/);
  if (folderMatch) {
    const name = folderMatch[1].trim();
    const result = await runAction("createFolder", { name, parentId: null });
    return {
      text: result.ok ? `Created a folder called "${name}" in your workspace root.` : `Couldn't create that folder: ${result.message}`,
      fileRef: result.ok ? { type: "folder", id: result.id, name } : undefined,
    };
  }

  // ── create a note/file ─────────────────────────────────────────────
  const fileMatch = text.match(/(?:create|make|new) a?\s*(?:file|note) (?:called|named)?\s*"?([^"]+)"?$/);
  if (fileMatch) {
    const name = fileMatch[1].trim();
    const result = await runAction("createFile", { name, parentId: null, content: "" });
    return {
      text: result.ok ? `Created "${name}" in your workspace root.` : `Couldn't create that file: ${result.message}`,
      fileRef: result.ok ? { type: "file", id: result.id, name } : undefined,
    };
  }

  // ── search ───────────────────────────────────────────────────────
  const searchMatch = text.match(/(?:search for|find)\s+"?([^"]+)"?$/);
  if (searchMatch) {
    const query = searchMatch[1].trim();
    const result = await runAction("searchNodes", { query });
    if (!result.ok) return { text: `Search failed: ${result.message}` };
    if (result.results.length === 0) return { text: `No matches for "${query}".` };
    const names = result.results.slice(0, 10).map((n) => n.name);
    return { text: `Found ${result.results.length}: ${names.join(", ")}${result.results.length > 10 ? ", ..." : ""}` };
  }

  // ── rename ───────────────────────────────────────────────────────
  const renameMatch = text.match(/rename\s+"?([^"]+?)"?\s+to\s+"?([^"]+)"?$/);
  if (renameMatch) {
    const [, from, to] = renameMatch;
    const found = await runAction("searchNodes", { query: from.trim() });
    const target = found.ok && found.results.find((n) => n.name.toLowerCase() === from.trim().toLowerCase());
    if (!target) return { text: `I couldn't find anything named "${from.trim()}".` };
    const result = await runAction("renameNode", { id: target.id, name: to.trim() });
    return { text: result.ok ? `Renamed "${from.trim()}" to "${to.trim()}".` : `Couldn't rename it: ${result.message}` };
  }

  // ── trash ────────────────────────────────────────────────────────
  const trashMatch = text.match(/(?:trash|delete|remove)\s+"?([^"]+)"?$/);
  if (trashMatch) {
    const name = trashMatch[1].trim();
    const found = await runAction("searchNodes", { query: name });
    const target = found.ok && found.results.find((n) => n.name.toLowerCase() === name.toLowerCase());
    if (!target) return { text: `I couldn't find anything named "${name}".` };
    const result = await runAction("trashNode", { id: target.id });
    return { text: result.ok ? `Moved "${name}" to Trash.` : `Couldn't trash it: ${result.message}` };
  }

  // ── workspace stats ──────────────────────────────────────────────
  if (text.includes("workspace") && (text.includes("stat") || text.includes("what's in") || text.includes("summar"))) {
    const result = await runAction("getWorkspaceStats", {});
    return {
      text: result.ok
        ? `You have ${result.fileCount} file(s) and ${result.folderCount} folder(s) in your workspace.`
        : "I couldn't read your workspace stats right now.",
    };
  }

  if (text.includes("move a file") || text.includes("how do i move")) {
    return { text: "Open Files, then drag any file onto a folder to move it — or right-click it for more options." };
  }

  return {
    text:
      "I didn't catch a command there. Try things like \"open Files\", \"open folder Documents/Projects\", " +
      "\"what's in Documents\", \"create a folder called Ideas\", or tap the ? button above for the full list.",
  };
}
