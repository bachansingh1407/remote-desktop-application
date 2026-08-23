"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, Power, LogOut, Grid3x3, Pin } from "lucide-react";
import { useWindowStore, useAuthStore } from "@/app/stores";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { useAllApps } from "@/app/lib/appRegistry";
import { getGreeting } from "@/app/lib/utils/greeting";

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

    const allApps = useAllApps();

    const filteredApps = useMemo(() => {
        if (!query.trim()) return allApps;
        return allApps.filter((app) =>
            app.title.toLowerCase().includes(query.toLowerCase())
        );
    }, [query, allApps]);

    const pinnedApps = useMemo(() => allApps.filter((a) => a.pinned), [allApps]);
    const isSearching = query.trim().length > 0;
    const visibleApps = isSearching ? filteredApps : tab === "pinned" ? pinnedApps : allApps;

    const firstName = user?.name?.trim()?.split(" ")[0];
    const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? "C";

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
            style={{ bottom: TASKBAR_HEIGHT + 10 }}
            className="fixed left-3 z-[10001] w-[440px] overflow-hidden rounded-2xl
                 border border-border bg-background-elevated
                 backdrop-blur-2xl backdrop-saturate-150
                 shadow-[0_24px_64px_rgba(0,0,0,0.45)] animate-scale-in"
        >
            {/* header — greeting + avatar, sets the tone the way a real start
                menu does before you even start typing */}
            {/* <div
                className="relative flex items-center gap-3 overflow-hidden px-4 pb-4 pt-4"
                style={{
                    background:
                        "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 65%)",
                }}
            >
                <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-medium text-white ring-1 ring-black/5"
                    style={{
                        background:
                            "linear-gradient(155deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 55%, black))",
                        boxShadow: "0 6px 18px -8px color-mix(in srgb, var(--color-accent) 70%, transparent)",
                    }}
                >
                    {initial}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold text-foreground">
                        {getGreeting(firstName)}
                    </p>
                    <p className="truncate text-[11px] text-foreground-secondary">
                        {user?.email ?? "Signed in"}
                    </p>
                </div>
            </div> */}

            {/* search */}
            <div className="px-4 pb-3 mt-5">
                <div className="relative">
                    <Search
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-secondary/70"
                    />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search apps..."
                        className="w-full rounded-xl border border-border bg-black/[0.035] dark:bg-white/[0.05]
                       py-3 pl-10 pr-9 text-[13.5px] text-foreground placeholder-foreground-secondary/70
                       outline-none transition-all duration-150 focus:border-accent/55 focus:bg-black/[0.05]
                       focus:ring-[3px] focus:ring-accent/10 dark:focus:bg-white/[0.07]"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center
                                       rounded-full text-foreground-secondary/60 transition-colors hover:bg-black/[0.06]
                                       hover:text-foreground dark:hover:bg-white/[0.08]"
                        >
                            <span className="text-[13px] leading-none">×</span>
                        </button>
                    )}
                </div>
            </div>

            {/* pinned / all apps toggle — hidden while searching, since search
                already spans every app */}
            {!isSearching && (
                <div className="flex shrink-0 gap-1 px-4 pb-2.5">
                    <TabButton icon={Pin} label="Pinned" active={tab === "pinned"} onClick={() => setTab("pinned")} />
                    <TabButton icon={Grid3x3} label="All apps" active={tab === "all"} onClick={() => setTab("all")} />
                </div>
            )}
            {isSearching && (
                <p className="px-4 pb-2 text-[11px] text-foreground-secondary/70">
                    {visibleApps.length} result{visibleApps.length === 1 ? "" : "s"} for &quot;{query}&quot;
                </p>
            )}

            {/* app grid */}
            <div className="max-h-[300px] overflow-y-auto px-3 pb-2">
                {visibleApps.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                            <Search size={16} className="text-foreground-secondary/50" />
                        </span>
                        <p className="text-[12px] text-foreground-secondary">
                            No apps match &quot;{query}&quot;
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-0.5">
                        {visibleApps.map((app) => (
                            <button
                                key={app.id}
                                onClick={() => handleLaunch(app)}
                                disabled={app.comingSoon}
                                title={app.comingSoon ? `${app.title} — coming soon` : app.title}
                                className={`group flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center
                            transition-colors ${app.comingSoon
                                        ? "cursor-not-allowed opacity-40"
                                        : "hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                                    }`}
                            >
                                <span
                                    className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm
                                     transition-transform duration-150 group-hover:scale-[1.06] group-active:scale-95"
                                    style={{
                                        background: `linear-gradient(155deg, ${app.color ?? "#6B7280"}, color-mix(in srgb, ${app.color ?? "#6B7280"} 65%, black))`,
                                    }}
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
                    <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white"
                        style={{
                            background:
                                "linear-gradient(155deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 55%, black))",
                        }}
                    >
                        {initial}
                    </span>
                    <div className="flex flex-col">
                        <span className="text-[11.5px] text-foreground">
                            {user?.name ?? "Guest"}
                        </span>
                        <p className="truncate text-[11px] text-foreground">
                            {user?.email ?? "Signed in"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => {
                            logout();
                            closeMenu();
                        }}
                        title="Sign out"
                        className="flex h-8 w-8 items-center justify-center rounded-lg
                       text-foreground-secondary transition-colors
                       hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
                    >
                        <LogOut size={15} strokeWidth={1.5} />
                    </button>
                    <button
                        title="Power"
                        className="flex h-8 w-8 items-center justify-center rounded-lg
                       text-foreground-secondary transition-colors
                       hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/[0.08]"
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
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-medium transition-all duration-150
                ${active
                    ? "bg-accent/15 text-accent ring-1 ring-accent/20"
                    : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}
        >
            <Icon size={12} />
            {label}
        </button>
    );
}