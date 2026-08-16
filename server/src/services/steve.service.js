const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// ---------------------------------------------------------------------------
// Steve's persona. This is the ONLY place his voice is defined — the
// frontend sends no system message of its own, so changing how Steve talks
// is a one-file backend edit, no frontend redeploy needed.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Steve, the head of operations for Campus — a browser-based desktop OS built by a developer named Bachan Singh.

Who you are:
- You're the one assistant in Campus. Not a narrow FAQ bot — you can hold a real conversation, explain things, give advice, and actually DO things in the person's workspace when they ask.
- Your tone: direct, competent, a little dry-witted, never corporate or over-eager. You talk like a sharp coworker who's good at their job, not like a chirpy product mascot.
- Keep replies tight. A sentence or two for simple things. Only go longer when the question genuinely needs it (explaining a concept, walking through steps).

What you can actually do:
- You have tools to open apps, create folders/notes, search the workspace, rename or trash items, list folder contents, and check workspace stats.
- Use a tool whenever the person is asking you to DO something, not just discuss it. Don't narrate that you're "going to use a tool" — just call it.
- If a request is ambiguous (e.g. "delete that file" with no name), ask ONE short clarifying question instead of guessing.
- For general knowledge, advice, explaining code, brainstorming, writing help, or anything outside the workspace tools — just answer directly like a capable assistant would. You are not limited to workspace operations.
- If someone asks who built Campus: Bachan Singh, a full-stack developer, built the whole thing solo — frontend, backend, database, all of it.

Constraints:
- Never invent a tool result. If a tool call fails, say so plainly and suggest what to try instead.
- Don't ask for confirmation before routine, non-destructive actions (creating a folder, opening an app, searching). DO ask before trashing something if the person hasn't clearly named what to trash.`;

// ---------------------------------------------------------------------------
// Tool schema (OpenAI-compatible function calling — Groq implements the
// same spec). Deliberately a curated subset of everything the frontend's
// systemActionsStore can do: destructive/rare actions (empty trash, delete
// forever, restore, move, duplicate) are intentionally left OUT of what
// Steve can trigger from a chat message. Those stay behind explicit UI
// clicks in Files/Trash, not something an LLM free-associates its way into.
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "open_app",
      description:
        "Open an app window on the Campus desktop. Valid appId values: files, write, snippets, calendar, community, steve, tool-console, trash, integrations, settings.",
      parameters: {
        type: "object",
        properties: { appId: { type: "string" } },
        required: ["appId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Create a new folder in the person's workspace.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Folder name." },
          parentPath: {
            type: "string",
            description: 'Optional path to the parent folder, e.g. "Documents/Projects". Omit for the workspace root.',
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Create a new blank text file (note) in the person's workspace.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          parentPath: { type: "string", description: 'Optional parent folder path. Omit for workspace root.' },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_folder",
      description: "List the contents of a folder by path.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: 'e.g. "Documents/Projects". Use "" for the workspace root.' },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_workspace",
      description: "Search every file and folder in the workspace by name.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_item",
      description: "Rename a file or folder. Matches the first item found with the given current name.",
      parameters: {
        type: "object",
        properties: {
          fromName: { type: "string" },
          toName: { type: "string" },
        },
        required: ["fromName", "toName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trash_item",
      description: "Move a file or folder to Trash. Matches the first item found with the given name. Ask the person to confirm the exact name first if there's any ambiguity.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "workspace_stats",
      description: "Get a quick file/folder count summary of the whole workspace.",
      parameters: { type: "object", properties: {} },
    },
  },
];

/**
 * Sends a chat completion request to Groq. `messages` should NOT include a
 * system message — this function always prepends Steve's own system
 * prompt, so the frontend never needs to know (or be trusted to send) it.
 */
async function chatCompletion(messages) {
  if (!env.groq.apiKey) {
    throw ApiError.internal("Steve isn't configured yet — no GROQ_API_KEY set on the server.");
  }

  const body = {
    model: env.groq.model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    tools: TOOLS,
    tool_choice: "auto",
    temperature: 0.4,
    max_tokens: 800,
  };

  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groq.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error("Groq request failed to send", { error: err.message });
    throw ApiError.internal("Couldn't reach Steve's brain right now. Try again in a moment.");
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    logger.error("Groq returned an error", { status: response.status, body: errText });
    throw ApiError.internal("Steve hit a snag processing that. Try again in a moment.");
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;

  if (!message) {
    logger.error("Groq response missing a message", { data });
    throw ApiError.internal("Steve didn't have anything to say — try again.");
  }

  return message;
}

module.exports = { chatCompletion, TOOLS, SYSTEM_PROMPT };
