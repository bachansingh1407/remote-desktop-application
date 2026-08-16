import { create } from "zustand";

let convoIdCounter = 1;
const nextConvoId = () => `convo-${convoIdCounter++}`;

let msgIdCounter = 1;
const nextMsgId = () => msgIdCounter++;

function makeConversation(title = "New chat") {
  return {
    id: nextConvoId(),
    title,
    // What renders in the chat UI — simplified, display-only.
    messages: [
      {
        id: nextMsgId(),
        role: "assistant",
        text: "Hey — what do you need?",
      },
    ],
    // Raw OpenAI-format history (no system message — the backend owns
    // that) sent to /steve/chat on every turn so Groq has real context.
    // Includes tool-call/tool-result turns the UI never shows directly.
    apiHistory: [],
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const initialConvo = makeConversation();

export const useSteveOpsStore = create((set, get) => ({
  conversations: { [initialConvo.id]: initialConvo },
  activeId: initialConvo.id,
  thinking: false,

  setActiveId: (id) => set({ activeId: id }),

  createConversation: () => {
    const convo = makeConversation();
    set((s) => ({
      conversations: { ...s.conversations, [convo.id]: convo },
      activeId: convo.id,
    }));
    return convo.id;
  },

  // Appends the person's message to both the display list and the raw
  // history that gets sent to Groq for context.
  appendUserMessage: (id, text) => {
    set((s) => {
      const convo = s.conversations[id];
      if (!convo) return s;
      const title = convo.title === "New chat" ? text.slice(0, 40) + (text.length > 40 ? "…" : "") : convo.title;
      return {
        conversations: {
          ...s.conversations,
          [id]: {
            ...convo,
            title,
            messages: [...convo.messages, { id: nextMsgId(), role: "user", text }],
            apiHistory: [...convo.apiHistory, { role: "user", content: text }],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  // Appends the result of a full Steve turn: `rawMessages` is everything
  // sendToSteve() returned (assistant tool-call msg, tool results, final
  // assistant msg) — all of it goes into apiHistory for context, but only
  // the FINAL assistant message (with its fileRefs and a summary of which
  // tools ran) gets rendered as a chat bubble.
  appendAssistantTurn: (id, rawMessages, fileRefs = []) => {
    set((s) => {
      const convo = s.conversations[id];
      if (!convo) return s;

      const finalMsg = rawMessages[rawMessages.length - 1];
      const toolNames = rawMessages.filter((m) => m.role === "tool").map((m) => m.name);

      return {
        conversations: {
          ...s.conversations,
          [id]: {
            ...convo,
            messages: [
              ...convo.messages,
              {
                id: nextMsgId(),
                role: "assistant",
                text: finalMsg?.content || "Done.",
                toolsUsed: toolNames.length ? toolNames : undefined,
                fileRefs: fileRefs.length ? fileRefs : undefined,
              },
            ],
            apiHistory: [...convo.apiHistory, ...rawMessages],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  // Purely cosmetic — used once for Steve's first-ever multi-line
  // introduction, played back as real chat bubbles instead of a separate
  // non-interactive intro screen. Not added to apiHistory: Groq doesn't
  // need to "remember" Steve's own scripted intro as context.
  seedAssistantMessages: (id, texts) => {
    set((s) => {
      const convo = s.conversations[id];
      if (!convo) return s;
      const newMessages = texts.map((text) => ({ id: nextMsgId(), role: "assistant", text }));
      return {
        conversations: {
          ...s.conversations,
          [id]: { ...convo, messages: [...convo.messages, ...newMessages], updatedAt: Date.now() },
        },
      };
    });
  },

  appendErrorMessage: (id, text) => {
    set((s) => {
      const convo = s.conversations[id];
      if (!convo) return s;
      return {
        conversations: {
          ...s.conversations,
          [id]: {
            ...convo,
            messages: [...convo.messages, { id: nextMsgId(), role: "assistant", text, isError: true }],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  renameConversation: (id, title) =>
    set((s) => (s.conversations[id] ? { conversations: { ...s.conversations, [id]: { ...s.conversations[id], title } } } : s)),

  archiveConversation: (id, archived = true) =>
    set((s) => (s.conversations[id] ? { conversations: { ...s.conversations, [id]: { ...s.conversations[id], archived } } } : s)),

  deleteConversation: (id) =>
    set((s) => {
      const next = { ...s.conversations };
      delete next[id];
      return { conversations: next };
    }),

  clearConversation: (id) =>
    set((s) => {
      if (!s.conversations[id]) return s;
      const fresh = makeConversation(s.conversations[id].title);
      return { conversations: { ...s.conversations, [id]: { ...fresh, id, title: s.conversations[id].title } } };
    }),

  setThinking: (thinking) => set({ thinking }),

  getList: () => Object.values(get().conversations).sort((a, b) => b.updatedAt - a.updatedAt),
}));