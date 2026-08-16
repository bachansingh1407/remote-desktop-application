"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Copy, Check, Wrench, AlertTriangle, Folder, FileText } from "lucide-react";

// Reveals an assistant reply a couple of words at a time — gives the
// "live, thinking as it types" feel of a real chat product instead of
// text just appearing all at once. Only animates once per message (the
// parent tracks which ids have already played via `skipAnimation`), so
// scrolling back through history never re-triggers it.
function RevealText({ text, skipAnimation, onDone }) {
  const [shown, setShown] = useState(skipAnimation ? text : "");

  useEffect(() => {
    if (skipAnimation) {
      setShown(text);
      return;
    }
    const words = text.split(" ");
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 2;
      setShown(words.slice(0, i).join(" "));
      if (i >= words.length) {
        clearInterval(id);
        onDone?.();
      }
    }, 34);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <p className="whitespace-pre-wrap">{shown}</p>;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-foreground-secondary/60"
          style={{
            animation: "steve-typing-dot 1.1s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes steve-typing-dot {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-3px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-foreground-secondary/50 opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-foreground-secondary group-hover:opacity-100 dark:hover:bg-white/[0.08]"
      title="Copy"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

export default function SteveChatThread({
  messages,
  thinking,
  onSend,
  onOpenFileRef,
  compact = false,
  suggestions = [],
  placeholder = "Ask Steve anything...",
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const revealedIds = useRef(new Set());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || thinking) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, compact ? 90 : 130)}px`;
    }
  };

  const bubbleText = compact ? "text-[12.5px]" : "text-[13px]";
  const bubblePad = compact ? "px-3 py-2" : "px-3.5 py-2.5";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isLast = idx === messages.length - 1;
          const alreadyRevealed = revealedIds.current.has(m.id);

          return (
            <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`group flex ${compact ? "max-w-[88%]" : "max-w-[80%]"} flex-col gap-1`}>
                {m.toolsUsed && (
                  <div className="flex flex-wrap items-center gap-1 text-[9.5px] text-foreground-secondary/70">
                    <Wrench size={9} />
                    {m.toolsUsed.map((t) => t.replace(/_/g, " ")).join(", ")}
                  </div>
                )}

                <div
                  className={`relative rounded-2xl ${bubblePad} ${bubbleText} leading-relaxed ${
                    isUser
                      ? "rounded-br-sm bg-accent text-white"
                      : m.isError
                      ? "rounded-bl-sm border border-red-500/30 bg-red-500/10 text-red-500"
                      : "rounded-bl-sm bg-background-secondary text-foreground"
                  }`}
                >
                  {m.isError && <AlertTriangle size={12} className="mb-1 inline-block" />}

                  {!isUser && !m.isError ? (
                    <RevealText
                      text={m.text}
                      skipAnimation={alreadyRevealed || !isLast}
                      onDone={() => revealedIds.current.add(m.id)}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{m.text}</p>
                  )}

                  {m.fileRefs?.map((ref) => (
                    <button
                      key={ref.id}
                      onClick={() => onOpenFileRef?.(ref)}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg bg-black/10 px-2.5 py-1.5 text-left hover:bg-black/20 dark:bg-black/20 dark:hover:bg-black/30"
                    >
                      {ref.type === "folder" ? (
                        <Folder size={13} className="text-accent" />
                      ) : (
                        <FileText size={13} className="text-amber-500" />
                      )}
                      <span className="truncate">{ref.name}</span>
                    </button>
                  ))}

                  {!isUser && !m.isError && (
                    <div className="absolute -right-1 -top-1">
                      <CopyButton text={m.text} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-background-secondary px-2">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && messages.length <= 1 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-3.5 pb-2">
          {suggestions.map((p) => (
            <button
              key={p}
              onClick={() => onSend(p)}
              className="rounded-full border border-border bg-black/[0.03] px-2.5 py-1 text-[10px] text-foreground-secondary hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-end gap-2 border-t border-border p-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="max-h-[130px] flex-1 resize-none rounded-xl border border-border bg-black/[0.03] px-3 py-2 text-xs
                     text-foreground outline-none placeholder-foreground-secondary/60 focus:border-accent/50 dark:bg-white/[0.04]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all ${
            !input.trim() || thinking
              ? "cursor-not-allowed text-foreground-secondary/40"
              : "bg-accent text-white hover:brightness-110 active:scale-95"
          }`}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}