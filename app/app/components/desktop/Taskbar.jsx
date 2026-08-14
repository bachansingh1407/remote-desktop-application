"use client";

import { useState, useEffect } from "react";
import { Search, Sun, Moon, Settings, Monitor } from "lucide-react";
import { useWindowStore, useThemeStore } from "@/app/stores";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { getApp } from "@/app/lib/appRegistry";
import SettingsApp from "@/app/apps/settings/SettingsApp";
import StartMenu from "./StartMenu";
import { openCommandPalette } from "@/app/components/common/CommandPalette";

// Same gradient recipe used for every app tile across the shell (StartMenu,
// desktop icons) — kept local since it's a one-liner, but deliberately
// identical so the taskbar's running-app tiles read as the same family of
// object, not a separate visual system.
function tileGradient(hex) {
    const color = hex ?? "#6B7280";
    return `linear-gradient(155deg, ${color}, color-mix(in srgb, ${color} 62%, black))`;
}

export default function Taskbar() {
    const [startMenuOpen, setStartMenuOpen] = useState(false);
    // Ids minimized by the last "show desktop" press — pressing it again
    // restores exactly those windows, giving the classic press-to-hide,
    // press-to-bring-back toggle instead of a one-way action.
    const [peekIds, setPeekIds] = useState(null);

    const windows = useWindowStore((s) => s.windows);
    const focusWindow = useWindowStore((s) => s.focusWindow);
    const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
    const restoreWindow = useWindowStore((s) => s.restoreWindow);
    const minimizeAllWindows = useWindowStore((s) => s.minimizeAllWindows);
    const restoreWindows = useWindowStore((s) => s.restoreWindows);

    const openWindow = useWindowStore((s) => s.openWindow);
    const theme = useThemeStore((s) => s.theme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);

    const topZIndex =
        windows.length > 0 ? Math.max(...windows.map((w) => w.zIndex)) : -1;

    // Any real user window action (opening/focusing/closing anything)
    // invalidates a pending "show desktop" restore — otherwise pressing
    // the strip after manually reopening something would fight the user.
    useEffect(() => {
        if (!peekIds) return;
        const stillValid = peekIds.every((id) => windows.some((w) => w.id === id));
        if (!stillValid) setPeekIds(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windows]);

    const handleAppClick = (win) => {
        setPeekIds(null);
        if (win.minimized) {
            restoreWindow(win.id);
            return;
        }
        const isFocused = win.zIndex === topZIndex;
        if (isFocused) {
            minimizeWindow(win.id);
        } else {
            focusWindow(win.id);
        }
    };

    const handleShowDesktop = () => {
        if (peekIds) {
            restoreWindows(peekIds);
            setPeekIds(null);
            return;
        }
        const visibleIds = windows.filter((w) => !w.minimized).map((w) => w.id);
        if (visibleIds.length === 0) return;
        minimizeAllWindows();
        setPeekIds(visibleIds);
    };

    const handleOpenSettings = () => {
        openWindow({
            id: "settings",
            title: "Settings",
            content: <SettingsApp />,
            width: 800,
            height: 500,
            minWidth: 700,
            minHeight: 500,
        });
    };

    return (
        <>
            <StartMenu open={startMenuOpen} onClose={() => setStartMenuOpen(false)} />

            <div style={{ height: TASKBAR_HEIGHT }} className="fixed inset-x-0 bottom-0 z-[10000] flex items-stretch">
                {/* glass surface — layered so it reads as actual frosted glass
                    (top highlight + soft base tint + outer lift) instead of a
                    flat semi-transparent rectangle, which is what made it look
                    cheap/placeholder-y in light mode specifically. */}
                <div className="pointer-events-none absolute inset-0 bg-background-elevated backdrop-blur-2xl backdrop-saturate-[1.8]" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-black/[0.04] dark:from-white/[0.03] dark:to-black/[0.12]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.08] to-transparent dark:via-white/[0.14]" />
                <div className="pointer-events-none absolute inset-0 border-t border-black/[0.07] dark:border-white/[0.09]" />
                <div className="pointer-events-none absolute inset-0 shadow-[0_-12px_36px_-6px_rgba(0,0,0,0.16)] dark:shadow-[0_-12px_36px_-6px_rgba(0,0,0,0.5)]" />

                <div className="relative flex flex-1 items-center gap-1.5 px-2">
                    {/* start — same tile language as every app icon, so it reads
                        as "the first tile in the dock" rather than a mystery
                        button that happens to live in the corner */}
                    <button
                        onClick={() => setStartMenuOpen((v) => !v)}
                        className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
                       transition-all duration-150 active:scale-90
                       ${startMenuOpen ? "" : "hover:scale-[1.06]"}`}
                        title="Start"
                    >
                        <span
                            className="absolute inset-0 rounded-xl shadow-sm transition-shadow"
                            style={{
                                background: tileGradient("var(--color-accent)"),
                                boxShadow: startMenuOpen
                                    ? "0 0 0 2px color-mix(in srgb, var(--color-accent) 45%, transparent)"
                                    : "0 2px 8px -2px color-mix(in srgb, var(--color-accent) 55%, transparent)",
                            }}
                        />
                        <svg viewBox="0 0 24 24" className="relative h-[17px] w-[17px] text-white" fill="none">
                            <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.95" />
                            <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.65" />
                            <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.65" />
                            <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.95" />
                        </svg>
                    </button>

                    {/* search — opens the command palette (Ctrl/Cmd+K also works anywhere) */}
                    <button
                        onClick={() => openCommandPalette()}
                        className="flex h-9 min-w-[130px] flex-1 max-w-xs items-center gap-2 rounded-xl
                       border border-black/[0.06] bg-black/[0.03] px-3
                       text-foreground-secondary transition-all
                       hover:border-black/[0.09] hover:bg-black/[0.055] hover:text-foreground
                       active:scale-[0.99]
                       dark:border-white/[0.06] dark:bg-white/[0.04] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.07]"
                        title="Search (Ctrl+K)"
                    >
                        <Search size={14} strokeWidth={1.9} className="shrink-0" />
                        <span className="hidden truncate text-[12px] md:inline">Search Campus</span>
                        {/* <kbd className="ml-auto hidden shrink-0 rounded-md border border-black/[0.08] bg-white/60 px-1.5 py-0.5 text-[9.5px] font-medium text-foreground-secondary/80 lg:inline dark:border-white/10 dark:bg-black/20">
                            ⌘K
                        </kbd> */}
                    </button>

                    {/* running apps — centered dock, each a colored tile that
                        lights up fully when focused instead of a bare icon
                        floating on nothing */}
                    <div className="flex flex-1 items-center justify-center gap-1.5">
                        {windows.map((win) => {
                            const isFocused = win.zIndex === topZIndex && !win.minimized;
                            const app = getApp(win.id);
                            const AppIcon = win.icon ?? app?.icon;
                            const accentColor = app?.color ?? "#6B7280";
                            return (
                                <button
                                    key={win.id}
                                    onClick={() => handleAppClick(win)}
                                    title={win.title}
                                    className={`group relative flex h-9 w-9 items-center justify-center rounded-xl
                              transition-all duration-150 active:scale-90 hover:scale-[1.06]
                              ${win.minimized ? "opacity-50" : ""}`}
                                >
                                    <span
                                        className="absolute inset-0 rounded-xl transition-all duration-150"
                                        style={
                                            isFocused
                                                ? {
                                                      background: tileGradient(accentColor),
                                                      boxShadow: `0 3px 10px -3px color-mix(in srgb, ${accentColor} 65%, transparent)`,
                                                  }
                                                : {
                                                      background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
                                                  }
                                        }
                                    />
                                    <span className="absolute inset-0 rounded-xl bg-black/0 transition-colors group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.06]" />

                                    {AppIcon ? (
                                        <AppIcon
                                            size={16}
                                            strokeWidth={1.85}
                                            className="relative transition-transform duration-150"
                                            style={{ color: isFocused ? "#fff" : accentColor }}
                                        />
                                    ) : (
                                        <span className="relative text-[12px] font-semibold" style={{ color: isFocused ? "#fff" : accentColor }}>
                                            {win.title?.charAt(0)?.toUpperCase() ?? "?"}
                                        </span>
                                    )}

                                    {/* focused indicator — small pill under the active tile only */}
                                    {isFocused && (
                                        <span
                                            className="absolute -bottom-[5px] left-1/2 h-[3px] w-3.5 -translate-x-1/2 rounded-full"
                                            style={{ backgroundColor: accentColor }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* system tray — right side */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={toggleTheme}
                            className="flex h-9 w-9 items-center justify-center rounded-xl
                         text-foreground transition-all
                         hover:bg-black/[0.055] active:scale-90
                         dark:hover:bg-white/[0.08]"
                            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                        >
                            {theme === "dark" ? (
                                <Sun size={16} strokeWidth={1.85} />
                            ) : (
                                <Moon size={16} strokeWidth={1.85} />
                            )}
                        </button>

                        <button
                            onClick={handleOpenSettings}
                            className="flex h-9 w-9 items-center justify-center rounded-xl
                         text-foreground transition-all
                         hover:bg-black/[0.055] active:scale-90
                         dark:hover:bg-white/[0.08]"
                            title="Settings"
                        >
                            <Settings size={16} strokeWidth={1.85} />
                        </button>
                    </div>

                    {/* show desktop — thin edge strip, exactly where every real
                        desktop OS puts it: flush against the far right corner of
                        the taskbar, separate from everything else in the tray */}
                    <button
                        onClick={handleShowDesktop}
                        title={peekIds ? "Restore windows" : "Show desktop"}
                        className={`ml-1 flex h-full w-3.5 shrink-0 items-center justify-center border-l border-black/[0.06] dark:border-white/[0.08]
                       transition-colors
                       hover:bg-black/[0.06] active:bg-black/[0.09]
                       dark:hover:bg-white/[0.08]
                       ${peekIds ? "bg-accent/10" : ""}`}
                    >
                        <Monitor
                            size={11}
                            strokeWidth={1.85}
                            className={`transition-colors ${
                                peekIds ? "text-accent" : "text-foreground-secondary/40 hover:text-foreground-secondary"
                            }`}
                        />
                    </button>
                </div>
            </div>
        </>
    );
}