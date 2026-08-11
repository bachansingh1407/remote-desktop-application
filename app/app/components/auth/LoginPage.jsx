"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Pencil,
} from "lucide-react";
import { useAuthStore } from "@/app/stores";
import { MAX_ATTEMPTS } from "@/app/stores/useAuthStore";
import { getGreeting } from "@/app/lib/utils/greeting";
import { getWallpaperCss } from "@/app/lib/wallpapers";

/**
 * DESIGN NOTE — why this ignores the light/dark theme toggle:
 *
 * A real macOS lock/login screen never follows the system appearance
 * setting — it always sits on top of the wallpaper, tuned for contrast
 * against a photo, not a UI surface. This screen does the same on purpose:
 * always the dark wallpaper + frosted glass, regardless of what the person
 * has Settings set to for the desktop itself. The one thing that *does*
 * carry over from their theme is `--color-accent` (used for the avatar
 * gradient, the glow, and the loading ring), so it still feels like *their*
 * Campus, not a generic lock screen.
 */

// Ticks once a minute (aligned to the minute boundary, not a raw interval)
// so the big clock changes exactly when a real clock would, without a
// pointless re-render every second for a display that only shows HH:MM.
function useLiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId;
    const scheduleNext = () => {
      const msToNextMinute = 60_000 - (Date.now() % 60_000);
      timeoutId = setTimeout(() => {
        setNow(new Date());
        scheduleNext();
      }, msToNextMinute);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return now;
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const failedAttempts = useAuthStore((s) => s.failedAttempts);

  const [email, setEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const shakeTimeoutRef = useRef(null);

  const now = useLiveClock();
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    emailRef.current?.focus();
    return () => clearTimeout(shakeTimeoutRef.current);
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    clearTimeout(shakeTimeoutRef.current);
    shakeTimeoutRef.current = setTimeout(() => setShake(false), 420);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError(!email.trim() ? "Enter your email to continue" : "Enter your password to continue");
      triggerShake();
      if (!email.trim()) setEditingEmail(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.replace("/");
    } catch (err) {
      setError(err?.message || "That didn't work — try again");
      setPassword("");
      triggerShake();
      passwordRef.current?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const commitEmail = () => {
    setEditingEmail(false);
    if (email.trim()) passwordRef.current?.focus();
  };

  const attemptsRemaining = MAX_ATTEMPTS - failedAttempts;
  const showAttemptsWarning = failedAttempts > 0 && attemptsRemaining > 0;
  const initial = email.trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      {/* ── background: the app's own default wallpaper, full-bleed ──── */}
      <div className="absolute inset-0" style={{ background: getWallpaperCss("default") }} />

      {/* slow-drifting glow blobs — depth cue, not decoration; both tie back
          to colors already in the product (accent + the wallpaper's navy) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="login-aurora login-aurora--a"
          style={{ background: "var(--color-accent)" }}
        />
        <div className="login-aurora login-aurora--b" />
      </div>

      {/* vignette for text contrast, independent of wallpaper choice */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      {/* ── corner chrome — quiet brand + copyright, mac-style restraint ─ */}
      <div className="absolute left-6 top-6 flex items-center gap-2 animate-fade-in">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-white">C</span>
        </div>
        <span className="text-[12.5px] font-medium tracking-tight text-white/70">Campus</span>
      </div>
      <p className="absolute bottom-5 right-6 text-[10.5px] text-white/35 animate-fade-in">
        © {now.getFullYear()} Campus
      </p>
      <p className="absolute bottom-5 left-6 max-w-[220px] text-[10.5px] leading-snug text-white/35 animate-fade-in">
        No public sign-up — accounts are provisioned by an administrator.
      </p>

      {/* ── main stack ─────────────────────────────────────────────── */}
      <div className="relative flex w-full max-w-sm flex-col items-center px-6 text-center">
        {/* live clock — the signature element of this screen */}
        <div className="mb-9 select-none animate-fade-in" style={{ animationFillMode: "backwards" }}>
          <div
            className="font-sans text-[68px] leading-none tracking-tight text-white [font-variant-numeric:tabular-nums]"
            style={{ fontWeight: 200 }}
          >
            {time}
          </div>
          <div className="mt-2.5 text-[12.5px] font-medium tracking-wide text-white/45">{date}</div>
        </div>

        {/* greeting eyebrow */}
        {/* <p
          className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35 animate-fade-in"
          style={{ animationDelay: "60ms", animationFillMode: "backwards" }}
        >
          {getGreeting()}
        </p> */}

        {/* avatar — gradient built from the person's own accent color, with
            a soft ring that only spins while a request is in flight */}
        {/* <div
          className="relative mb-3.5 flex h-[72px] w-[72px] items-center justify-center animate-scale-in"
          style={{ animationDelay: "90ms", animationFillMode: "backwards" }}
        >
          {isSubmitting && (
            <div className="absolute -inset-[3px] animate-spin rounded-full border-2 border-transparent border-t-white/70 border-r-white/25" />
          )}
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full text-[24px] font-medium text-white ring-1 ring-white/15 transition-transform duration-200"
            style={{
              background: "linear-gradient(155deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 55%, black))",
              boxShadow: "0 10px 28px -10px color-mix(in srgb, var(--color-accent) 70%, transparent)",
            }}
          >
            {initial}
          </div>
        </div> */}

        {/* account line — click to edit, mac never makes you look at a
            boring bordered input box just to tell it who you are */}
        <div
          className="mb-6 flex min-h-[26px] items-center justify-center animate-fade-in"
          style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
        >
          {editingEmail ? (
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={commitEmail}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEmail();
                }
              }}
              placeholder="you@company.com"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={isSubmitting}
              className="w-56 border-b border-white/25 bg-transparent px-0.5 pb-1 text-center text-[15px] text-white outline-none placeholder-white/35 transition-colors focus:border-white/70 disabled:opacity-50"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingEmail(true)}
              disabled={isSubmitting}
              className="group flex items-center gap-1.5 text-[15px] font-medium text-white/90 transition-opacity disabled:opacity-60"
            >
              {email.trim() || "Enter your email"}
              <Pencil size={11} className="text-white/35 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
        </div>

        {/* password + submit */}
        <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-4">
          <div
            className={`relative w-[272px] animate-fade-in ${shake ? "login-shake" : ""}`}
            style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
          >
            <input
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              disabled={isSubmitting}
              className="h-12 w-full rounded-full border border-white/15 bg-white/[0.08] pl-5 pr-[76px] text-[14px] text-white placeholder-white/40 outline-none backdrop-blur-xl transition-all duration-200 focus:border-white/40 focus:bg-white/[0.13] focus:ring-4 focus:ring-white/[0.08] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              disabled={isSubmitting}
              className="absolute right-[42px] top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/85 disabled:opacity-40"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              aria-label="Sign in"
              className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#14162b] shadow-md transition-all duration-150 hover:brightness-95 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            >
              {isSubmitting ? (
                <Loader2 size={15} className="animate-spin" strokeWidth={2.25} />
              ) : (
                <ArrowRight size={15} strokeWidth={2.25} />
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-rose-300 animate-fade-in">
              <AlertCircle size={12} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {showAttemptsWarning && (
            <p className="text-[11px] text-white/40">
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining before lockout
            </p>
          )}
        </form>
      </div>

      {/* keyframes local to this screen — kept out of globals.css since
          nothing else in the app uses a drifting-aurora or shake effect */}
      <style>{`
        .login-aurora {
          position: absolute;
          width: 60vmax;
          height: 60vmax;
          border-radius: 9999px;
          filter: blur(120px);
          opacity: 0.28;
        }
        .login-aurora--a {
          top: -18vmax;
          left: -12vmax;
          animation: login-drift-a 22s ease-in-out infinite;
        }
        .login-aurora--b {
          bottom: -22vmax;
          right: -14vmax;
          background: #3a4bd6;
          animation: login-drift-b 26s ease-in-out infinite;
        }
        @keyframes login-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(6vmax, 4vmax) scale(1.08); }
        }
        @keyframes login-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-5vmax, -3vmax) scale(1.05); }
        }
        .login-shake { animation: login-shake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
        @keyframes login-shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-6px); }
          40%, 60% { transform: translateX(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .login-aurora--a, .login-aurora--b { animation: none; }
          .login-shake { animation: none; }
        }
      `}</style>
    </div>
  );
}