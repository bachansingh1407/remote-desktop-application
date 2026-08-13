"use client";

import { useState, useEffect, useRef } from "react";
import { ExternalLink, RefreshCw, Link2, Check, AlertTriangle } from "lucide-react";

// Window content for a user-added integration (see apps/integrations).
// Just an iframe with a thin, consistent chrome bar on top — reload, copy
// link, and an always-visible "open in a real tab" escape hatch, since a
// same-origin JS check can't reliably tell us whether a third-party site
// is refusing to be framed (X-Frame-Options / CSP frame-ancestors fail
// silently from inside the page).
export default function WebAppFrame({ url, name }) {
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setSlow(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timerRef.current);
  }, [reloadKey, url]);

  const handleLoad = () => {
    setLoading(false);
    setSlow(false);
  };

  const handleRefresh = () => setReloadKey((k) => k + 1);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (permissions/HTTP context) — not critical.
    }
  };

  if (!url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-background text-center text-foreground-secondary">
        <AlertTriangle size={20} strokeWidth={1.75} />
        <p className="text-[12.5px]">No URL configured for this app.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-background-elevated px-2.5 py-1.5">
        <button
          onClick={handleRefresh}
          title="Reload"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-border bg-background px-2 py-1 text-[11px] text-foreground-secondary/75">
          <Link2 size={10.5} className="shrink-0 text-foreground-secondary/40" />
          <span className="truncate">{url}</span>
        </div>
        <button
          onClick={handleCopy}
          title="Copy URL"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          {copied ? <Check size={12} className="text-emerald-500" /> : <Link2 size={12} />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ExternalLink size={12} />
        </a>
      </div>

      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-2.5 bg-background">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
            <p className="text-[11.5px] text-foreground-secondary/60">Loading {name || "app"}...</p>
            {slow && (
              <p className="max-w-[240px] text-center text-[11px] text-foreground-secondary/50">
                Taking a while — if it never loads, this site may block being embedded. Try &quot;Open in new tab&quot;.
              </p>
            )}
          </div>
        )}
        <iframe
          key={reloadKey}
          src={url}
          title={name || "Web app"}
          onLoad={handleLoad}
          className="h-full w-full border-0 bg-white"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}