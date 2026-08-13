"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, Search, Sun, Moon, Settings, Monitor, TvMinimal } from "lucide-react";
import { useWindowStore, useThemeStore } from "@/app/stores";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import { getApp } from "@/app/lib/appRegistry";
import SettingsApp from "@/app/apps/settings/SettingsApp";
import StartMenu from "./StartMenu";
import Clock from "./Clock";
import { openCommandPalette } from "@/app/components/common/CommandPalette";

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

            <div
                style={{ height: TASKBAR_HEIGHT }}
                className="fixed inset-x-0 bottom-0 z-[10000] flex items-stretch"
            >
                {/* glass surface — separated from the flex row below so the
                    hairline top-edge highlight can sit above everything without
                    fighting the row's own layout */}
                <div className="pointer-events-none absolute inset-0 border-t border-border bg-background-elevated backdrop-blur-2xl backdrop-saturate-150 shadow-[0_-10px_32px_-8px_rgba(0,0,0,0.22)]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/10" />

                <div className="relative flex flex-1 items-center gap-1 px-2">
                    {/* start */}
                    <button
                        onClick={() => setStartMenuOpen((v) => !v)}
                        className={`group flex h-9 items-center gap-2 rounded-lg px-2.5
                       text-foreground transition-colors
                       hover:bg-black/[0.06] active:bg-black/[0.09]
                       dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]
                       ${startMenuOpen ? "bg-accent/15 text-accent" : ""}`}
                        title="Start"
                    >
                        <span
                            className={`flex h-8 w-8 items-center justify-center rounded-md text-white transition-transform cursor-pointer
                          ${startMenuOpen ? "scale-95" : "group-hover:scale-100"}`}
                            style={{
                                background:
                                    "linear-gradient(155deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 55%, black))",
                            }}
                        >
                            <TvMinimal size={18} strokeWidth={2} />
                        </span>
                        {/* <span className="hidden text-[12.5px] font-medium sm:inline">Campus</span> */}
                    </button>

                    {/* search — opens the command palette (Ctrl/Cmd+K also works anywhere) */}
                    <button
                        onClick={() => openCommandPalette()}
                        className="flex h-9 min-w-[120px] flex-1 max-w-xs items-center gap-2 rounded-lg
                       border border-transparent bg-black/[0.035] px-3
                       text-foreground-secondary transition-colors
                       hover:border-border hover:bg-black/[0.06] hover:text-foreground
                       active:bg-black/[0.09]
                       dark:bg-white/[0.035] dark:hover:bg-white/[0.07]"
                        title="Search (Ctrl+K)"
                    >
                        <Search size={14} strokeWidth={1.75} className="shrink-0" />
                        <span className="hidden truncate text-[12px] md:inline">Search Campus</span>
                        {/* <kbd className="ml-auto hidden shrink-0 rounded border border-border/80 bg-black/[0.04] px-1.5 py-0.5 text-[9.5px] text-foreground-secondary/70 lg:inline dark:bg-white/[0.06]">
                            ⌘K
                        </kbd> */}
                    </button>

                    {/* running apps — centered, pinned-taskbar style */}
                    <div className="flex flex-1 items-center justify-center gap-1">
                        {windows.map((win) => {
                            const isFocused = win.zIndex === topZIndex && !win.minimized;
                            const app = getApp(win.id);
                            const AppIcon = win.icon ?? app?.icon;
                            const accentColor = app?.color ?? "var(--color-accent)";
                            return (
                                <button
                                    key={win.id}
                                    onClick={() => handleAppClick(win)}
                                    title={win.title}
                                    className={`group relative flex h-9 w-9 items-center justify-center rounded-lg
                              transition-all duration-150
                              hover:bg-black/[0.06] active:scale-90
                              dark:hover:bg-white/[0.08]
                              ${isFocused ? "bg-black/[0.07] dark:bg-white/[0.09]" : ""}
                              ${win.minimized ? "opacity-55" : ""}`}
                                >
                                    {AppIcon ? (
                                        <AppIcon
                                            size={17}
                                            strokeWidth={1.7}
                                            className="transition-transform duration-150 group-hover:scale-110"
                                            style={{ color: accentColor }}
                                        />
                                    ) : (
                                        <span className="text-[12px] font-semibold text-foreground">
                                            {win.title?.charAt(0)?.toUpperCase() ?? "?"}
                                        </span>
                                    )}

                                    {/* running indicator — pill when focused, dot when
                                        running in background, faint dot when minimized */}
                                    <span
                                        className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 rounded-full transition-all duration-200"
                                        style={{
                                            height: 3,
                                            width: isFocused ? 14 : 5,
                                            backgroundColor: isFocused ? accentColor : "var(--color-foreground-secondary)",
                                            opacity: isFocused ? 1 : win.minimized ? 0.35 : 0.65,
                                        }}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {/* system tray — right side */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={toggleTheme}
                            className="flex h-9 w-9 items-center justify-center rounded-lg
                         text-foreground transition-colors
                         hover:bg-black/[0.06] active:bg-black/[0.09]
                         dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]"
                            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                        >
                            {theme === "dark" ? (
                                <Sun size={16} strokeWidth={1.75} />
                            ) : (
                                <Moon size={16} strokeWidth={1.75} />
                            )}
                        </button>

                        <button
                            onClick={handleOpenSettings}
                            className="flex h-9 w-9 items-center justify-center rounded-lg
                         text-foreground transition-colors
                         hover:bg-black/[0.06] active:bg-black/[0.09]
                         dark:hover:bg-white/[0.08] dark:active:bg-white/[0.12]"
                            title="Settings"
                        >
                            <Settings size={16} strokeWidth={1.75} />
                        </button>

                        <div className="mx-1 h-5 w-px bg-border" />

                        <Clock />
                    </div>

                    {/* show desktop — thin edge strip, exactly where every real
                        desktop OS puts it: flush against the far right corner of
                        the taskbar, separate from everything else in the tray */}
                    <button
                        onClick={handleShowDesktop}
                        title={peekIds ? "Restore windows" : "Show desktop"}
                        className={`ml-1.5 flex h-full w-3.5 shrink-0 items-center justify-center border-l border-border
                       transition-colors
                       hover:bg-black/[0.07]
                       active:bg-black/[0.1]
                       dark:hover:bg-white/[0.09]
                       ${peekIds ? "bg-accent/10" : ""}`}
                    >
                        <Monitor
                            size={11}
                            strokeWidth={1.75}
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