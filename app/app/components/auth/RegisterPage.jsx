"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/app/stores";
import { getWallpaperCss } from "@/app/lib/wallpapers";

/**
 * Sibling screen to LoginPage — same frosted-glass-on-wallpaper language,
 * just a stacked form instead of the click-to-edit account line, since
 * three fields (name/email/password) don't fit that pattern gracefully.
 */
export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef(null);
  const shakeTimeoutRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
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

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Fill in every field to continue");
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password });
      router.replace("/");
    } catch (err) {
      setError(err?.message || "Could not create your account — try again");
      triggerShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0" style={{ background: getWallpaperCss("default") }} />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="login-aurora login-aurora--a" style={{ background: "var(--color-accent)" }} />
        <div className="login-aurora login-aurora--b" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      <div className="absolute left-6 top-6 flex items-center gap-2 animate-fade-in">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
          <span className="text-[11px] font-semibold text-white">C</span>
        </div>
        <span className="text-[12.5px] font-medium tracking-tight text-white/70">Campus</span>
      </div>
      <p className="absolute bottom-5 right-6 text-[10.5px] text-white/35 animate-fade-in">
        © {new Date().getFullYear()} Campus
      </p>

      <div className="relative flex w-full max-w-sm flex-col items-center px-6 text-center">
        <div className="mb-8 animate-fade-in" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-[22px] font-medium tracking-tight text-white">Create your account</h1>
          <p className="mt-1.5 text-[12.5px] text-white/45">Takes about ten seconds</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`flex w-[272px] flex-col items-center gap-3 animate-fade-in ${shake ? "login-shake" : ""}`}
          style={{ animationDelay: "80ms", animationFillMode: "backwards" }}
        >
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            autoComplete="name"
            disabled={isSubmitting}
            className="h-12 w-full rounded-full border border-white/15 bg-white/[0.08] px-5 text-[14px] text-white placeholder-white/40 outline-none backdrop-blur-xl transition-all duration-200 focus:border-white/40 focus:bg-white/[0.13] focus:ring-4 focus:ring-white/[0.08] disabled:opacity-50"
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={isSubmitting}
            className="h-12 w-full rounded-full border border-white/15 bg-white/[0.08] px-5 text-[14px] text-white placeholder-white/40 outline-none backdrop-blur-xl transition-all duration-200 focus:border-white/40 focus:bg-white/[0.13] focus:ring-4 focus:ring-white/[0.08] disabled:opacity-50"
          />

          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              disabled={isSubmitting}
              className="h-12 w-full rounded-full border border-white/15 bg-white/[0.08] pl-5 pr-12 text-[14px] text-white placeholder-white/40 outline-none backdrop-blur-xl transition-all duration-200 focus:border-white/40 focus:bg-white/[0.13] focus:ring-4 focus:ring-white/[0.08] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              disabled={isSubmitting}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/85 disabled:opacity-40"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="w-full px-1 text-left text-[10.5px] leading-snug text-white/30">
            At least 8 characters, with a letter and a number.
          </p>

          {error && (
            <div className="flex items-center gap-1.5 text-[12px] text-rose-300 animate-fade-in">
              <AlertCircle size={12} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-medium text-[#14162b] shadow-md transition-all duration-150 hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 size={15} className="animate-spin" strokeWidth={2.25} />
            ) : (
              <>
                Create account
                <ArrowRight size={15} strokeWidth={2.25} />
              </>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push("/login")}
          disabled={isSubmitting}
          className="mt-6 text-[12.5px] text-white/45 transition-colors hover:text-white/80 disabled:opacity-40 animate-fade-in"
          style={{ animationDelay: "140ms", animationFillMode: "backwards" }}
        >
          Already have an account? <span className="text-white/80">Sign in</span>
        </button>
      </div>

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