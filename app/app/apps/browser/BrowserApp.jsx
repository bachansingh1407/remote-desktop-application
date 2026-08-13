"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Plus, X, ArrowLeft, ArrowRight, RotateCw, Home, Globe, ShieldCheck,
  Search, ExternalLink, AlertTriangle,
} from "lucide-react";

// ── Sandbox allowlist ───────────────────────────────────────────────────
// Only these hosts can be navigated to. Most real-world sites (Google,
// YouTube, X, most news sites...) send X-Frame-Options / CSP frame-ancestors
// headers that block embedding outright — that's a browser security
// feature we can't route around from inside the iframe, so this list is
// deliberately curated to sites known to allow being framed. Swap these
// for whatever you've verified works for your use case.
const ALLOWED_SITES = [
  { host: "www.youtube.com", url: "https://www.youtube.com", label: "Youtube", color: "#1a908a" },
  { host: "wikipedia.org", url: "https://www.wikipedia.org", label: "Wikipedia", color: "#374151" },
  { host: "jsonplaceholder.typicode.com", url: "https://jsonplaceholder.typicode.com", label: "JSONPlaceholder", color: "#0ea5e9" },
  { host: "medium.com", url: "https://medium.com/", label: "Medium", color: "#16a34a" },
  { host: "netlify.app", url: "https://bachansingh.netlify.app/", label: "Portfolio", color: "#db2777" },
  { host: "www.w3.org", url: "https://www.w3.org", label: "W3C", color: "#1d4ed8" },
];

const HOME_URL = "about:home";

function matchSite(urlString) {
  try {
    const { hostname } = new URL(urlString);
    return ALLOWED_SITES.find((s) => hostname === s.host || hostname.endsWith(`.${s.host}`)) || null;
  } catch {
    return null;
  }
}

function isAllowed(urlString) {
  if (urlString === HOME_URL) return true;
  return matchSite(urlString) !== null;
}

// Turns whatever a person typed into the address bar into a real URL —
// bare hostnames/search terms fall back to https:// so "example.com" and
// "https://example.com" both work without the user thinking about it.
function normalizeInput(raw) {
  const value = raw.trim();
  if (!value) return HOME_URL;
  if (value === "home" || value === HOME_URL) return HOME_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w-]+(\.[\w-]+)+/.test(value)) return `https://${value}`;
  return value;
}

let tabSeq = 0;
function makeTab(url = HOME_URL) {
  tabSeq += 1;
  return {
    id: `tab-${tabSeq}`,
    history: [url],
    historyIndex: 0,
    loading: url !== HOME_URL,
    reloadKey: 0,
  };
}

export default function BrowserApp({ initialUrl = HOME_URL } = {}) {
  const [tabs, setTabs] = useState(() => [makeTab(initialUrl)]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id);
  const [addressDraft, setAddressDraft] = useState("");
  const [addressFocused, setAddressFocused] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(null); // url string or null

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeUrl = activeTab?.history[activeTab.historyIndex] ?? HOME_URL;
  const activeSite = useMemo(() => matchSite(activeUrl), [activeUrl]);
  const canGoBack = (activeTab?.historyIndex ?? 0) > 0;
  const canGoForward = activeTab ? activeTab.historyIndex < activeTab.history.length - 1 : false;

  const updateTab = useCallback((id, updater) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...updater(t) } : t)));
  }, []);

  const newTab = useCallback((url = HOME_URL) => {
    const tab = makeTab(url);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setBlockedNotice(null);
  }, []);

  const closeTab = useCallback((id) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev; // always keep at least one tab open
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTabId) {
        const fallback = next[Math.max(0, idx - 1)] ?? next[0];
        setActiveTabId(fallback.id);
      }
      return next;
    });
  }, [activeTabId]);

  const navigate = useCallback((rawUrl) => {
    const url = normalizeInput(rawUrl);
    if (!isAllowed(url)) {
      setBlockedNotice(url);
      return;
    }
    setBlockedNotice(null);
    updateTab(activeTabId, (t) => {
      const truncated = t.history.slice(0, t.historyIndex + 1);
      return {
        history: [...truncated, url],
        historyIndex: truncated.length,
        loading: url !== HOME_URL,
        reloadKey: t.reloadKey,
      };
    });
  }, [activeTabId, updateTab]);

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    updateTab(activeTabId, (t) => ({ historyIndex: t.historyIndex - 1, loading: true }));
  }, [activeTabId, canGoBack, updateTab]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    updateTab(activeTabId, (t) => ({ historyIndex: t.historyIndex + 1, loading: true }));
  }, [activeTabId, canGoForward, updateTab]);

  const refresh = useCallback(() => {
    updateTab(activeTabId, (t) => ({ reloadKey: t.reloadKey + 1, loading: activeUrl !== HOME_URL }));
  }, [activeTabId, activeUrl, updateTab]);

  const goHome = useCallback(() => navigate(HOME_URL), [navigate]);

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    navigate(addressDraft);
  };

  const handleIframeLoad = () => {
    updateTab(activeTabId, () => ({ loading: false }));
  };

  const displayValue = addressFocused ? addressDraft : (activeUrl === HOME_URL ? "" : activeUrl);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* tab strip */}
      <div className="flex shrink-0 items-end gap-1 border-b border-border bg-background-secondary/50 px-2 pt-2">
        {tabs.map((tab) => {
          const url = tab.history[tab.historyIndex];
          const site = matchSite(url);
          const isActive = tab.id === activeTabId;
          const title = url === HOME_URL ? "New Tab" : (site?.label ?? url.replace(/^https?:\/\//, ""));
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTabId(tab.id); setBlockedNotice(null); }}
              className={`group relative flex max-w-[168px] shrink items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-[12px] transition-colors duration-100
                ${isActive ? "bg-background text-foreground font-medium" : "text-foreground-secondary hover:bg-foreground/[0.04]"}`}
            >
              <span
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
                style={{ background: site?.color ?? "var(--foreground-secondary)", opacity: site ? 1 : 0.4 }}
              >
                {tab.loading ? (
                  <RotateCw size={8} className="animate-spin text-white" />
                ) : (
                  <Globe size={8} className="text-white" />
                )}
              </span>
              <span className="truncate">{title}</span>
              {tabs.length > 1 && (
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-foreground-secondary/60 opacity-0 transition-opacity duration-100 hover:bg-foreground/[0.08] hover:text-foreground group-hover:opacity-100"
                >
                  <X size={11} />
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => newTab()}
          title="New tab"
          className="mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-foreground-secondary transition-colors duration-100 hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* nav + address bar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background px-2.5 py-2">
        <div className="flex items-center gap-0.5">
          <NavButton icon={ArrowLeft} title="Back" onClick={goBack} disabled={!canGoBack} />
          <NavButton icon={ArrowRight} title="Forward" onClick={goForward} disabled={!canGoForward} />
          <NavButton icon={RotateCw} title="Reload" onClick={refresh} spinning={activeTab?.loading} />
          <NavButton icon={Home} title="Home" onClick={goHome} />
        </div>

        <form onSubmit={handleAddressSubmit} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background-secondary/60 px-2.5 py-[6px] transition-colors duration-150 focus-within:border-accent/45 focus-within:ring-[3px] focus-within:ring-accent/10">
          {activeSite ? (
            <ShieldCheck size={13} className="shrink-0 text-emerald-500" />
          ) : (
            <Search size={13} className="shrink-0 text-foreground-secondary/50" />
          )}
          <input
            value={displayValue}
            onChange={(e) => setAddressDraft(e.target.value)}
            onFocus={(e) => { setAddressFocused(true); setAddressDraft(activeUrl === HOME_URL ? "" : activeUrl); e.target.select(); }}
            onBlur={() => setAddressFocused(false)}
            placeholder="Search or enter a sandboxed URL"
            className="w-full min-w-0 bg-transparent text-[12.5px] text-foreground outline-none placeholder-foreground-secondary/50"
          />
        </form>

        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-600 sm:flex">
          <ShieldCheck size={11} />
          Sandboxed
        </span>
      </div>

      {/* content */}
      <div className="relative min-h-0 flex-1 bg-background">
        {blockedNotice ? (
          <BlockedNotice url={blockedNotice} onPick={(u) => { setBlockedNotice(null); navigate(u); }} onDismiss={() => setBlockedNotice(null)} />
        ) : activeUrl === HOME_URL ? (
          <StartPage onPick={navigate} />
        ) : (
          <>
            {activeTab?.loading && (
              <div className="absolute inset-x-0 top-0 z-10 h-[2px] overflow-hidden bg-accent/15">
                <div className="h-full w-1/3 animate-[loadingBar_1.1s_ease-in-out_infinite] bg-accent" />
              </div>
            )}
            <iframe
              key={`${activeTab.id}-${activeTab.reloadKey}-${activeTab.historyIndex}`}
              src={activeUrl}
              title={activeSite?.label ?? activeUrl}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onLoad={handleIframeLoad}
            />
          </>
        )}
      </div>

      {/* footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-background-secondary/40 px-3 py-1.5 text-[10.5px] text-foreground-secondary/70">
        <span className="truncate">{activeUrl === HOME_URL ? "Start page" : activeUrl}</span>
        <span>{ALLOWED_SITES.length} sites allowed</span>
      </div>

      <style jsx>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}

function NavButton({ icon: Icon, title, onClick, disabled, spinning }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary transition-colors duration-100 hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <Icon size={14} className={spinning ? "animate-spin" : ""} />
    </button>
  );
}

// New-tab / home page — a grid of shortcuts into the allowlist, so the
// sandboxing is visible and self-explanatory rather than a silent
// restriction someone discovers by typing a blocked URL.
function StartPage({ onPick }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Globe size={24} strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[15px] font-semibold text-foreground">Sandboxed Browser</p>
          <p className="mt-1 text-[12px] text-foreground-secondary/70">Only the sites below can be opened here</p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onPick(value); }}
        className="flex w-full max-w-md items-center gap-2 rounded-xl border border-border bg-background-secondary/60 px-3 py-2.5"
      >
        <Search size={14} className="shrink-0 text-foreground-secondary/50" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search or enter a sandboxed URL"
          className="w-full min-w-0 bg-transparent text-[13px] text-foreground outline-none placeholder-foreground-secondary/50"
        />
      </form>

      <div className="grid w-full max-w-md grid-cols-3 gap-3">
        {ALLOWED_SITES.map((site) => (
          <button
            key={site.host}
            onClick={() => onPick(site.url)}
            className="flex flex-col items-center gap-2 rounded-xl p-3 text-center transition-colors duration-100 hover:bg-foreground/[0.04]"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-[11px] text-white shadow-sm"
              style={{
                backgroundImage: `linear-gradient(160deg, color-mix(in srgb, ${site.color} 88%, white) 0%, ${site.color} 50%, color-mix(in srgb, ${site.color} 82%, black) 100%)`,
              }}
            >
              <Globe size={16} strokeWidth={1.9} />
            </span>
            <span className="line-clamp-1 text-[11px] font-medium text-foreground-secondary">{site.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Shown instead of a blank/broken iframe when someone navigates to a host
// that isn't on the allowlist — explains *why*, rather than failing silently.
function BlockedNotice({ url, onPick, onDismiss }) {
  let host = url;
  try { host = new URL(url).hostname; } catch { /* keep raw string */ }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
        <AlertTriangle size={22} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-[13px] font-semibold text-foreground">This site isn't in the sandbox</p>
        <p className="mt-1 max-w-xs text-[12px] text-foreground-secondary/70">
          <span className="font-medium text-foreground-secondary">{host}</span> isn't on the allowed list, so it can't be opened here. Try one of these instead:
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {ALLOWED_SITES.map((site) => (
          <button
            key={site.host}
            onClick={() => onPick(site.url)}
            className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground-secondary transition-colors duration-100 hover:bg-foreground/[0.05] hover:text-foreground"
          >
            {site.label}
          </button>
        ))}
      </div>
      <button
        onClick={onDismiss}
        className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-accent hover:underline"
      >
        <ExternalLink size={12} />
        Go back
      </button>
    </div>
  );
}