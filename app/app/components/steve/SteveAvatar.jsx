"use client";

import { Bot, Squirrel } from "lucide-react";

const SIZES = {
  xs: { outer: "h-7 w-7", inner: "h-6 w-6", icon: 12, dot: "h-1.5 w-1.5" },
  sm: { outer: "h-10 w-10", inner: "h-9 w-9", icon: 17, dot: "h-2 w-2" },
  md: { outer: "h-12 w-12", inner: "h-11 w-11", icon: 20, dot: "h-2.5 w-2.5" },
  lg: { outer: "h-16 w-16", inner: "h-14 w-14", icon: 26, dot: "h-3 w-3" },
};

export default function SteveAvatar({ talking = false, size = "md", showStatus = false }) {
  const d = SIZES[size] ?? SIZES.md;
  return (
    <div className={`relative flex ${d.outer} shrink-0 items-center justify-center`}>
      <div
        className="absolute inset-0 rounded-full opacity-70 blur-md"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />
      <div
        className={`relative flex ${d.inner} items-center justify-center rounded-full border-2 border-accent/40 bg-gradient-to-br from-accent/25 to-accent/5 text-accent shadow-lg transition-transform ${
          talking ? "animate-[steve-bob_1.3s_ease-in-out_infinite]" : ""
        }`}
      >
        <Squirrel size={d.icon} />
      </div>
      {talking && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
        </span>
      )}
      {showStatus && !talking && (
        <span
          className={`absolute bottom-0 right-0 ${d.dot} rounded-full border-2 border-background bg-emerald-500`}
          title="Online"
        />
      )}
      <style jsx global>{`
        @keyframes steve-bob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>
    </div>
  );
}