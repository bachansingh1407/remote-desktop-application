"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/app/stores";
import { MAX_ATTEMPTS } from "@/app/stores/useAuthStore";
import { getGreeting } from "@/app/lib/utils/greeting";
// import { getGreeting } from "@/app/lib/utils/greeting";
// import { useAuthStore } from "../stores";
// import { MAX_ATTEMPTS } from "../stores/useAuthStore";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const failedAttempts = useAuthStore((s) => s.failedAttempts);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.replace("/");
    } catch (err) {
      setError(err?.message || "Access denied");
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const attemptsRemaining = MAX_ATTEMPTS - failedAttempts;
  const showAttemptsWarning = failedAttempts > 0 && attemptsRemaining > 0;

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
    
      {/* subtle grid texture, theme-aware via currentColor */}
      <div
        className="pointer-events-none absolute inset-0 text-foreground opacity-[0.03] dark:opacity-[0.05]"
        // style={{
        //   backgroundImage:
        //     "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
        //   backgroundSize: "40px 40px",
        // }}
      />

      {/* acrylic card — bg-background-elevated already carries the
          semi-transparent rgba from globals.css, so backdrop-blur gives
          the Fluent acrylic effect in both light and dark mode */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border
                   bg-background-elevated p-8
                   backdrop-blur-2xl backdrop-saturate-150"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-foreground/[0.04]">
            <ShieldCheck size={24} className="text-accent" strokeWidth={1.5} />
          </div>
          <h1 className="text-[15px] font-semibold text-foreground">{getGreeting()}</h1>
          <p className="mt-1 text-sm text-foreground-secondary">Sign in to unlock</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary/60"
            />
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-background-secondary/60 py-3 pl-10 pr-3
                         text-sm text-foreground placeholder-foreground-secondary/50 outline-none
                         transition-colors focus:border-accent/50 focus:bg-background-secondary
                         disabled:opacity-50"
            />
          </div>

          <div className="relative">
            <Lock
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary/60"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-border bg-background-secondary/60 py-3 pl-10 pr-10
                         text-sm text-foreground placeholder-foreground-secondary/50 outline-none
                         transition-colors focus:border-accent/50 focus:bg-background-secondary
                         disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-secondary/60 hover:text-foreground"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2">
              <AlertCircle size={14} className="shrink-0 text-red-500" />
              <p className="text-xs text-red-500">{error}</p>
            </div>
          )}

          {showAttemptsWarning && (
            <p className="text-center text-[10px] text-foreground-secondary/70">
              {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent py-3
                       text-sm font-medium text-white transition-opacity
                       hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-foreground-secondary/70">
          <ShieldCheck size={11} />
          Secured by Campus backend
        </div>
      </div>
    </div>
  );
}