import { create } from "zustand";

let convoIdCounter = 1;
const nextConvoId = () => `convo-${convoIdCounter++}`;

let msgIdCounter = 1;
const nextMsgId = () => msgIdCounter++;

const WELCOME_MESSAGE = () => ({
  id: 0,
  role: "assistant",
  text: "Hi — I'm your workspace assistant. Ask me to open something, create a folder, or how a feature works.",
});

function makeConversation(title = "New chat") {
  return {
    id: nextConvoId(),
    title,
    messages: [WELCOME_MESSAGE()],
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const initialConvo = makeConversation();

export const useAIAssistantStore = create((set, get) => ({
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

  appendMessage: (id, message) => {
    const withId = { id: message.id ?? nextMsgId(), ...message };
    set((s) => {
      const convo = s.conversations[id];
      if (!convo) return s;
      const messages = [...convo.messages, withId];
      const title =
        convo.title === "New chat" && withId.role === "user"
          ? withId.text.slice(0, 40) + (withId.text.length > 40 ? "…" : "")
          : convo.title;
      return {
        conversations: { ...s.conversations, [id]: { ...convo, messages, title, updatedAt: Date.now() } },
      };
    });
    return withId;
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
    set((s) =>
      s.conversations[id]
        ? { conversations: { ...s.conversations, [id]: { ...s.conversations[id], messages: [WELCOME_MESSAGE()], updatedAt: Date.now() } } }
        : s
    ),

  setThinking: (thinking) => set({ thinking }),

  getList: () => Object.values(get().conversations).sort((a, b) => b.updatedAt - a.updatedAt),
}));