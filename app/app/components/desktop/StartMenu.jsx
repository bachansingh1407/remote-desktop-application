"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Power, User, LogOut, Grid3x3, Pin } from "lucide-react";
import { useWindowStore, useAuthStore } from "@/app/stores";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { APP_REGISTRY } from "@/app/lib/appRegistry";

export default function StartMenu({ open, onClose }) {
    const [query, setQuery] = useState("");
    const [tab, setTab] = useState("pinned"); // "pinned" | "all"
    const menuRef = useRef(null);
    const inputRef = useRef(null);

    const openWindow = useWindowStore((s) => s.openWindow);
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    // Resetting query/tab here (an event handler), rather than reacting to
    // `open` becoming true in an effect, keeps every close path — outside
    // click, Escape, launching an app, signing out — consistently fresh for
    // next time without the cascading-render risk of setState-in-effect.
    const closeMenu = () => {
        onClose();
        setQuery("");
        setTab("pinned");
    };

    useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                closeMenu();
            }
        };
        const handleEscape = (e) => {
            if (e.key === "Escape") closeMenu();
        };

        document.addEventListener("pointerdown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("pointerdown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const filteredApps = useMemo(() => {
        if (!query.trim()) return APP_REGISTRY;
        return APP_REGISTRY.filter((app) =>
            app.title.toLowerCase().includes(query.toLowerCase())
        );
    }, [query]);

    const pinnedApps = useMemo(() => APP_REGISTRY.filter((a) => a.pinned), []);
    const isSearching = query.trim().length > 0;
    const visibleApps = isSearching ? filteredApps : tab === "pinned" ? pinnedApps : APP_REGISTRY;

    const handleLaunch = (app) => {
        if (app.comingSoon || !app.component) return;

        openWindow({
            id: app.id,
            title: app.title,
            content: <app.component />,
            width: app.width,
            height: app.height,
            minWidth: app.minWidth,
            minHeight: app.minHeight,
        });
        closeMenu();
    };

    if (!open) return null;

    return (
        <div
            ref={menuRef}
            style={{ bottom: TASKBAR_HEIGHT + 8 }}
            className="fixed left-1/2 z-[10001] w-[460px] -translate-x-1/2 overflow-hidden rounded-2xl
                 border border-border bg-background-elevated
                 backdrop-blur-2xl backdrop-saturate-150
                 shadow-[0_20px_56px_rgba(0,0,0,0.4)] animate-scale-in"
        >
            {/* search */}
            <div className="p-4 pb-3">
                <div className="relative">
                    <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary"
                    />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type to search apps..."
                        className="w-full rounded-xl border border-border bg-black/[0.03] dark:bg-white/[0.04]
                       py-2.5 pl-9 pr-3 text-[13px] text-foreground placeholder-foreground-secondary
                       outline-none transition-colors focus:border-accent/50"
                    />
                </div>
            </div>

            {/* pinned / all apps toggle — hidden while searching, since search
                already spans every app */}
            {!isSearching && (
                <div className="flex shrink-0 gap-1 px-4 pb-2">
                    <TabButton icon={Pin} label="Pinned" active={tab === "pinned"} onClick={() => setTab("pinned")} />
                    <TabButton icon={Grid3x3} label="All apps" active={tab === "all"} onClick={() => setTab("all")} />
                </div>
            )}

            {/* app grid */}
            <div className="max-h-[320px] overflow-y-auto px-4 pb-3">
                {visibleApps.length === 0 ? (
                    <p className="py-10 text-center text-[12px] text-foreground-secondary">
                        No apps found
                    </p>
                ) : (
                    <div className="grid grid-cols-4 gap-1">
                        {visibleApps.map((app) => (
                            <button
                                key={app.id}
                                onClick={() => handleLaunch(app)}
                                disabled={app.comingSoon}
                                title={app.comingSoon ? `${app.title} — coming soon` : app.title}
                                className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center
                            transition-colors ${
                                    app.comingSoon
                                        ? "cursor-not-allowed opacity-40"
                                        : "hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                }`}
                            >
                                <span
                                    className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
                                    style={{ backgroundColor: app.color ?? "#6B7280" }}
                                >
                                    <app.icon size={18} className="text-white" strokeWidth={1.8} />
                                </span>
                                <span className="line-clamp-1 text-[10.5px] text-foreground">
                                    {app.title}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-px bg-border" />

            {/* footer — account + power */}
            <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                        <User size={13} className="text-foreground-secondary" />
                    </div>
                    <span className="text-[12px] text-foreground">
                        {user?.name ?? "Guest"}
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            logout();
                            closeMenu();
                        }}
                        title="Sign out"
                        className="flex h-8 w-8 items-center justify-center rounded-lg
                       text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    >
                        <LogOut size={15} strokeWidth={1.5} />
                    </button>
                    <button
                        title="Power"
                        className="flex h-8 w-8 items-center justify-center rounded-lg
                       text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                    >
                        <Power size={15} strokeWidth={1.5} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TabButton({ icon: Icon, label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors
                ${active ? "bg-accent/15 text-accent" : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}
        >
            <Icon size={12} />
            {label}
        </button>
    );
}
