"use client";

import { useState } from "react";
import { LayoutGrid, Search, Sun, Moon, Settings } from "lucide-react";
import { useWindowStore, useThemeStore } from "@/app/stores";
import { TASKBAR_HEIGHT } from "@/app/lib/constants";
import SettingsApp from "@/app/apps/settings/SettingsApp";
import StartMenu from "./StartMenu";
import { openCommandPalette } from "@/app/components/common/CommandPalette";
// import Clock from "./Clock";

export default function Taskbar() {
    const [startMenuOpen, setStartMenuOpen] = useState(false);

    const windows = useWindowStore((s) => s.windows);
    const focusWindow = useWindowStore((s) => s.focusWindow);
    const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
    const restoreWindow = useWindowStore((s) => s.restoreWindow);

    const openWindow = useWindowStore((s) => s.openWindow);
    const theme = useThemeStore((s) => s.theme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);

    const topZIndex =
        windows.length > 0 ? Math.max(...windows.map((w) => w.zIndex)) : -1;

    const handleAppClick = (win) => {
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
                className="fixed inset-x-0 bottom-0 z-[10000] flex items-center
                 border-t border-border bg-background-elevated
                 backdrop-blur-2xl backdrop-saturate-150 px-2"
            >
                {/* start */}
                <button
                    onClick={() => setStartMenuOpen((v) => !v)}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg
                   text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
                   active:bg-black/[0.09] dark:active:bg-white/[0.12]
                   ${startMenuOpen ? "bg-black/[0.08] dark:bg-white/[0.1]" : ""}`}
                    title="Start"
                >
                    <LayoutGrid size={19} strokeWidth={1.5} />
                </button>

                {/* search — opens the command palette (Ctrl/Cmd+K also works anywhere) */}
                <button
                    onClick={() => openCommandPalette()}
                    className="ml-1 flex h-10 items-center gap-2 rounded-lg px-3
                   text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
                   active:bg-black/[0.09] dark:active:bg-white/[0.12]"
                    title="Search (Ctrl+K)"
                >
                    <Search size={17} strokeWidth={1.5} />
                    <span className="hidden text-[11px] text-foreground-secondary md:inline">Search</span>
                </button>

                {/* center — running apps, pinned taskbar style */}
                <div className="flex flex-1 items-center justify-center gap-1">
                    {windows.map((win) => {
                        const isFocused = win.zIndex === topZIndex && !win.minimized;
                        return (
                            <button
                                key={win.id}
                                onClick={() => handleAppClick(win)}
                                title={win.title}
                                className={`relative flex h-10 w-10 items-center justify-center rounded-lg
                          text-foreground text-[13px] font-medium
                          hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
                          active:bg-black/[0.09] dark:active:bg-white/[0.12]
                          ${isFocused ? "bg-black/[0.08] dark:bg-white/[0.1]" : ""}`}
                            >
                                {win.icon ? win.icon : <span>{win.title?.charAt(0)?.toUpperCase() ?? "?"}</span>}

                                {/* active indicator — bottom bar, taskbar style */}
                                <span
                                    className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-t
                            bg-accent transition-all duration-150
                            ${win.minimized ? "h-0.5 w-0" : isFocused ? "h-1 w-5" : "h-0.5 w-2"}`}
                                />
                            </button>
                        );
                    })}
                </div>

                {/* system tray — right side */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleTheme}
                        className="flex h-10 w-10 items-center justify-center rounded-lg
                     text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
                     active:bg-black/[0.09] dark:active:bg-white/[0.12]"
                        title="Toggle theme"
                    >
                        {theme === "dark" ? <Sun size={17} strokeWidth={1.5} /> : <Moon size={17} strokeWidth={1.5} />}
                    </button>

                    <button
                        onClick={handleOpenSettings}
                        className="flex h-10 w-10 items-center justify-center rounded-lg
             text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]
             active:bg-black/[0.09] dark:active:bg-white/[0.12]"
                        title="Settings"
                    >
                        <Settings size={17} strokeWidth={1.5} />
                    </button>

                    <div className="mx-1 h-6 w-px bg-border" />

                    {/* <Clock /> */}
                </div>
            </div>
        </>
    );
}