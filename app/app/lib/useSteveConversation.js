import { useEffect, useRef } from "react";
import { useSteveOpsStore } from "@/app/stores/useSteveOpsStore";
import { useSteveStore } from "@/app/stores/useSteveStore";
import { useAuthStore } from "@/app/stores";
import { sendToSteve } from "@/app/lib/steveClient";

// Played once, as real chat bubbles in the very first conversation, the
// very first time someone opens Steve — not a separate non-interactive
// "Welcome" screen disconnected from the actual chat.
const introLines = (firstName) => [
  `Hey ${firstName} — I'm Steve, head of operations around here.`,
  "I can actually do things, not just talk — open apps, create folders and notes, search your workspace, rename or trash stuff. Just ask normally, no fixed phrases needed.",
  "I also keep score quietly in the background as you explore. Ask me anything, or tell me what you need done.",
];

export function useSteveConversation(conversationId) {
  const conversations = useSteveOpsStore((s) => s.conversations);
  const activeId = useSteveOpsStore((s) => s.activeId);
  const thinking = useSteveOpsStore((s) => s.thinking);
  const appendUserMessage = useSteveOpsStore((s) => s.appendUserMessage);
  const appendAssistantTurn = useSteveOpsStore((s) => s.appendAssistantTurn);
  const appendErrorMessage = useSteveOpsStore((s) => s.appendErrorMessage);
  const seedAssistantMessages = useSteveOpsStore((s) => s.seedAssistantMessages);
  const setThinking = useSteveOpsStore((s) => s.setThinking);

  const user = useAuthStore((s) => s.user);
  const hasMetSteve = useSteveStore((s) => s.hasMetSteve);
  const completeFirstMeeting = useSteveStore((s) => s.completeFirstMeeting);

  const id = conversationId ?? activeId;
  const convo = conversations[id];
  const introRan = useRef(false);

  // Fires the scripted intro exactly once, ever — only into the very
  // first conversation that's ever existed, and only if nothing has
  // happened in it yet. Whichever surface (widget or full app) the
  // person opens first is where this plays; the other surface just sees
  // the normal short greeting from then on.
  useEffect(() => {
    if (introRan.current || !convo || hasMetSteve) return;
    if (Object.keys(conversations).length !== 1 || convo.messages.length !== 1) return;

    introRan.current = true;
    const firstName = (user?.name || "there").split(" ")[0];
    seedAssistantMessages(id, introLines(firstName));
    completeFirstMeeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo?.id, hasMetSteve]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || thinking || !convo) return;

    appendUserMessage(id, trimmed);
    setThinking(true);

    try {
      // Read fresh state — appendUserMessage above already updated the
      // store synchronously, but `convo` here is still this render's
      // pre-update snapshot.
      const freshHistory = useSteveOpsStore.getState().conversations[id].apiHistory;
      const { messages, fileRefs } = await sendToSteve(freshHistory);
      appendAssistantTurn(id, messages, fileRefs);
    } catch (err) {
      const message =
        err.response?.status === 429
          ? "Steve's getting hit with a lot of requests right now — give it a minute."
          : err.response?.data?.message || "Something went wrong on Steve's end. Try again.";
      appendErrorMessage(id, message);
    } finally {
      setThinking(false);
    }
  };

  return { conversation: convo, messages: convo?.messages ?? [], thinking, send };
}