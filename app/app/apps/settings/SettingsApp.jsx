"use client";

import { useState, useRef } from "react";
import {
    Check, User, Palette, HardDrive, LayoutGrid, Keyboard, Info,
    Download, Trash2, LogOut, Moon, Sun, ShieldAlert, Pencil, Lock,
    Image as ImageIcon, Upload, X, Loader2,
} from "lucide-react";
import { useAuthStore, useThemeStore, useFileSystemStore, useSettingsStore, ACCENT_PRESETS } from "@/app/stores";
import { toast } from "@/app/stores/useToastStore";
import { WALLPAPER_PRESETS, processWallpaperFile } from "@/app/lib/wallpapers";

const SECTIONS = [
    { id: "account", label: "Account", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "files", label: "Files & Storage", icon: HardDrive },
    { id: "workspace", label: "Workspace", icon: LayoutGrid },
    { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
    { id: "about", label: "About & Data", icon: Info },
];

export default function SettingsApp() {
    const [active, setActive] = useState("account");

    return (
        <div className="flex h-full bg-background text-foreground">
            {/* left nav */}
            <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-border p-2">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        onClick={() => setActive(s.id)}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors
                        ${active === s.id
                                ? "bg-accent/15 text-accent"
                                : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                            }`}
                    >
                        <s.icon size={14} strokeWidth={1.75} />
                        {s.label}
                    </button>
                ))}
            </nav>

            {/* content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {active === "account" && <AccountSection />}
                {active === "appearance" && <AppearanceSection />}
                {active === "files" && <FilesSection />}
                {active === "workspace" && <WorkspaceSection />}
                {active === "shortcuts" && <ShortcutsSection />}
                {active === "about" && <AboutSection />}
            </div>
        </div>
    );
}

// ---------- Account ----------
function AccountSection() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const updateProfile = useAuthStore((s) => s.updateProfile);
    const changePassword = useAuthStore((s) => s.changePassword);

    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(user?.name ?? "");
    const [savingName, setSavingName] = useState(false);

    const [busy, setBusy] = useState(false);

    const handleSignOut = async () => {
        setBusy(true);
        try {
            await logout();
        } finally {
            setBusy(false);
        }
    };

    const startEditName = () => {
        setNameValue(user?.name ?? "");
        setEditingName(true);
    };

    const commitName = async () => {
        const name = nameValue.trim();
        if (!name || name === user?.name) {
            setEditingName(false);
            return;
        }
        setSavingName(true);
        try {
            await updateProfile({ name });
            toast.success("Profile updated");
        } catch (err) {
            toast.error("Couldn't update profile", err.response?.data?.message || err.message);
        } finally {
            setSavingName(false);
            setEditingName(false);
        }
    };

    return (
        <Section title="Account" description="Your profile and sign-in details">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background-secondary/40 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <User size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    {editingName ? (
                        <input
                            autoFocus
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onBlur={commitName}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitName();
                                if (e.key === "Escape") setEditingName(false);
                            }}
                            className="w-full rounded border border-accent/50 bg-background px-1.5 py-0.5 text-sm font-medium text-foreground outline-none"
                        />
                    ) : (
                        <button onClick={startEditName} className="group flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{user?.name ?? "User"}</p>
                            {savingName ? (
                                <Loader2 size={11} className="animate-spin text-foreground-secondary" />
                            ) : (
                                <Pencil size={11} className="shrink-0 text-foreground-secondary/50 opacity-0 group-hover:opacity-100" />
                            )}
                        </button>
                    )}
                    <p className="truncate text-xs text-foreground-secondary">{user?.email}</p>
                </div>

                <button
                    onClick={handleSignOut}
                    disabled={busy}
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-black/[0.05] dark:bg-white/[0.06] px-3 py-1.5 text-xs
                       text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.1] disabled:opacity-50"
                >
                    <LogOut size={13} />
                    {busy ? "Signing out..." : "Sign out"}
                </button>
            </div>

            <ChangePasswordForm changePassword={changePassword} />
        </Section>
    );
}

function ChangePasswordForm({ changePassword }) {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const reset = () => {
        setOpen(false);
        setCurrent("");
        setNext("");
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            await changePassword(current, next);
            toast.success("Password changed");
            reset();
        } catch (err) {
            setError(err.response?.data?.message || "Couldn't change your password");
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <Field label="Password">
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-1.5 rounded-md bg-black/[0.05] dark:bg-white/[0.06] px-3 py-1.5 text-xs
                     text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                >
                    <Lock size={13} /> Change password
                </button>
            </Field>
        );
    }

    return (
        <Field label="Change password">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <input
                    type="password"
                    required
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    placeholder="Current password"
                    className="rounded-md border border-border bg-background-secondary/40 px-2.5 py-1.5 text-xs outline-none focus:border-accent/50"
                />
                <input
                    type="password"
                    required
                    minLength={8}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="New password (min. 8 characters)"
                    className="rounded-md border border-border bg-background-secondary/40 px-2.5 py-1.5 text-xs outline-none focus:border-accent/50"
                />
                {error && <p className="text-[11px] text-red-500">{error}</p>}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {busy ? "Updating..." : "Update password"}
                    </button>
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-md px-3 py-1.5 text-xs text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </Field>
    );
}

// ---------- Appearance ----------
function AppearanceSection() {
    const theme = useThemeStore((s) => s.theme);
    const toggleTheme = useThemeStore((s) => s.toggleTheme);

    const accentColor = useSettingsStore((s) => s.accentColor);
    const setAccentColor = useSettingsStore((s) => s.setAccentColor);
    const reduceMotion = useSettingsStore((s) => s.reduceMotion);
    const setReduceMotion = useSettingsStore((s) => s.setReduceMotion);

    return (
        <Section title="Appearance" description="Customize how your workspace looks and feels">
            <Field label="Accent color" hint="Used for selection highlights and active states across the app">
                <div className="flex gap-2">
                    {ACCENT_PRESETS.map((preset) => (
                        <button
                            key={preset.id}
                            onClick={() => setAccentColor(preset.value)}
                            title={preset.label}
                            className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105"
                            style={{ backgroundColor: preset.value }}
                        >
                            {accentColor === preset.value && (
                                <Check size={15} className="text-white" strokeWidth={3} />
                            )}
                        </button>
                    ))}
                </div>
            </Field>

            <Field label="Theme" hint="Switch between light and dark mode">
                <div className="flex gap-2">
                    <button
                        onClick={() => theme !== "dark" && toggleTheme()}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${theme === "dark"
                                ? "bg-accent/15 text-accent"
                                : "bg-black/[0.05] dark:bg-white/[0.06] text-foreground-secondary hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                            }`}
                    >
                        <Moon size={13} /> Dark
                    </button>
                    <button
                        onClick={() => theme !== "light" && toggleTheme()}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${theme === "light"
                                ? "bg-accent/15 text-accent"
                                : "bg-black/[0.05] dark:bg-white/[0.06] text-foreground-secondary hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                            }`}
                    >
                        <Sun size={13} /> Light
                    </button>
                </div>
            </Field>

            <ToggleField
                label="Reduce motion"
                hint="Turns off hover lift/scale animations on tiles and buttons"
                checked={reduceMotion}
                onChange={setReduceMotion}
            />

            <WallpaperField />
        </Section>
    );
}

function WallpaperField() {
    const wallpaper = useSettingsStore((s) => s.wallpaper);
    const customWallpaper = useSettingsStore((s) => s.customWallpaper);
    const setWallpaper = useSettingsStore((s) => s.setWallpaper);
    const setCustomWallpaper = useSettingsStore((s) => s.setCustomWallpaper);
    const clearCustomWallpaper = useSettingsStore((s) => s.clearCustomWallpaper);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("That's not an image");
            return;
        }
        setUploading(true);
        try {
            const dataUrl = await processWallpaperFile(file);
            setCustomWallpaper(dataUrl);
            toast.success("Wallpaper updated");
        } catch (err) {
            toast.error("Couldn't set that wallpaper", err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Field label="Wallpaper" hint="Pick a preset, or upload your own — your image is kept on this device and stays selected even after switching presets, so you can flip back without re-uploading">
            <div className="grid grid-cols-5 gap-2">
                {WALLPAPER_PRESETS.map((w) => (
                    <button
                        key={w.id}
                        onClick={() => setWallpaper(w.id)}
                        title={w.label}
                        className={`relative h-12 overflow-hidden rounded-lg ring-2 transition-all
                            ${wallpaper === w.id ? "ring-accent" : "ring-transparent hover:ring-border"}`}
                        style={{ backgroundImage: w.css }}
                    >
                        {wallpaper === w.id && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                                <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                            </span>
                        )}
                    </button>
                ))}

                {/* custom slot — always visible once an image has been uploaded, so
                    switching back to it later needs no re-import */}
                <button
                    onClick={() => (customWallpaper ? setWallpaper("custom") : fileInputRef.current?.click())}
                    title={customWallpaper ? "Your uploaded wallpaper" : "Upload an image"}
                    className={`relative flex h-12 items-center justify-center overflow-hidden rounded-lg bg-black/[0.04] ring-2 transition-all dark:bg-white/[0.05]
                        ${wallpaper === "custom" ? "ring-accent" : "ring-transparent hover:ring-border"}`}
                    style={customWallpaper ? { backgroundImage: `url(${customWallpaper})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                >
                    {!customWallpaper && (
                        uploading ? <Loader2 size={14} className="animate-spin text-foreground-secondary" /> : <Upload size={14} className="text-foreground-secondary" />
                    )}
                    {customWallpaper && wallpaper === "custom" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                            <Check size={14} className="text-white drop-shadow" strokeWidth={3} />
                        </span>
                    )}
                </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

            {customWallpaper && (
                <div className="mt-2 flex items-center gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                    >
                        <ImageIcon size={11} /> Replace uploaded image
                    </button>
                    <button
                        onClick={clearCustomWallpaper}
                        className="flex items-center gap-1 text-[11px] text-foreground-secondary hover:text-red-500"
                    >
                        <X size={11} /> Remove
                    </button>
                </div>
            )}
        </Field>
    );
}

// ---------- Files & Storage ----------
function FilesSection() {
    const defaultView = useSettingsStore((s) => s.defaultView);
    const setDefaultView = useSettingsStore((s) => s.setDefaultView);
    const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete);
    const setConfirmBeforeDelete = useSettingsStore((s) => s.setConfirmBeforeDelete);

    const items = useFileSystemStore((s) => s.items);
    const allItems = Object.values(items).filter((n) => n.id !== "root");

    const fileCount = allItems.filter((n) => n.type === "file").length;
    const folderCount = allItems.filter((n) => n.type === "folder").length;
    const totalBytes = allItems.reduce(
        (sum, n) => sum + (n.imported ? (n.size ?? 0) : new Blob([n.content ?? ""]).size),
        0
    );
    const estimatedKB = (totalBytes / 1024).toFixed(2);

    return (
        <Section title="Files & Storage" description="Defaults for how Files behaves, and what's using space">
            <Field label="Default view" hint="How Files opens a folder by default">
                <div className="flex gap-2">
                    {["grid", "list"].map((v) => (
                        <button
                            key={v}
                            onClick={() => setDefaultView(v)}
                            className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors ${defaultView === v
                                    ? "bg-accent text-white"
                                    : "bg-black/[0.05] dark:bg-white/[0.06] text-foreground-secondary hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                                }`}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </Field>

            <ToggleField
                label="Confirm before permanent delete"
                hint="Ask before deleting a file or folder forever"
                checked={confirmBeforeDelete}
                onChange={setConfirmBeforeDelete}
            />

            <Field label="Storage usage">
                <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Files" value={fileCount} />
                    <StatBox label="Folders" value={folderCount} />
                </div>
                <p className="mt-2 text-[11px] text-foreground-secondary">
                    ~{estimatedKB} KB used (synced to your Campus backend)
                </p>
            </Field>
        </Section>
    );
}

// ---------- Workspace ----------
function WorkspaceSection() {
    const taskbarPosition = useSettingsStore((s) => s.taskbarPosition);
    const iconSize = useSettingsStore((s) => s.iconSize);
    const setIconSize = useSettingsStore((s) => s.setIconSize);

    return (
        <Section title="Workspace" description="How the desktop and windows behave">
            <Field label="Desktop icon size">
                <div className="flex gap-2">
                    {["small", "medium", "large"].map((size) => (
                        <button
                            key={size}
                            onClick={() => setIconSize(size)}
                            className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors ${iconSize === size
                                    ? "bg-accent text-white"
                                    : "bg-black/[0.05] dark:bg-white/[0.06] text-foreground-secondary hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                                }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </Field>

            <Notice icon={ShieldAlert}>
                Taskbar is currently fixed to the bottom ({taskbarPosition}). Repositioning, pinned
                desktop icons, and startup apps will land here as those features are built.
            </Notice>
        </Section>
    );
}

// ---------- Shortcuts ----------
function ShortcutsSection() {
    const shortcuts = [
        { keys: "Double-click title bar", label: "Maximize / restore window" },
        { keys: "Drag title bar", label: "Move window" },
        { keys: "Drag bottom-right corner", label: "Resize window" },
        { keys: "Click taskbar icon", label: "Focus, minimize, or restore app" },
    ];

    return (
        <Section title="Shortcuts" description="Keyboard and mouse shortcuts available right now">
            <div className="overflow-hidden rounded-lg border border-border">
                {shortcuts.map((s, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between border-b border-border px-3 py-2.5 last:border-b-0"
                    >
                        <span className="text-xs text-foreground-secondary">{s.label}</span>
                        <kbd className="rounded border border-border bg-black/[0.04] dark:bg-white/[0.06] px-2 py-1 text-[10px] text-foreground-secondary">
                            {s.keys}
                        </kbd>
                    </div>
                ))}
            </div>
        </Section>
    );
}

// ---------- About & Data ----------
function AboutSection() {
    const items = useFileSystemStore((s) => s.items);
    const resetFileSystem = useFileSystemStore((s) => s.resetFileSystem);
    const resetSettings = useSettingsStore((s) => s.resetSettings);

    const handleExport = () => {
        const blob = new Blob([JSON.stringify(items, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `workspace-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleClearAll = () => {
        if (
            window.confirm(
                "This deletes every file, folder, and setting in your workspace. This can't be undone. Continue?"
            )
        ) {
            resetFileSystem();
            resetSettings();
        }
    };

    return (
        <Section title="About & Data" description="Export your work, or start fresh">
            <Field label="Export workspace" hint="Download everything as a JSON file you can keep as a backup">
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 rounded-md bg-black/[0.05] dark:bg-white/[0.06] px-3 py-1.5 text-xs
                     text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                >
                    <Download size={13} />
                    Export as JSON
                </button>
            </Field>

            <Field label="Clear workspace" hint="Permanently delete everything and start over">
                <button
                    onClick={handleClearAll}
                    className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/20"
                >
                    <Trash2 size={13} />
                    Clear everything
                </button>
            </Field>

            <div className="mt-4 border-t border-border pt-4 text-[11px] text-foreground-secondary">
                <p className="font-medium text-foreground">Campus <span className="text-accent">v1.0</span></p>
                <p className="mt-0.5">Data is stored in your browser and synced to your account, and persists across refreshes and devices.</p>
            </div>
        </Section>
    );
}

// ---------- shared bits ----------
function Section({ title, description, children }) {
    return (
        <div className="flex max-w-md flex-col gap-5">
            <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-0.5 text-xs text-foreground-secondary">{description}</p>
            </div>
            {children}
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <div>
            <p className="mb-1 text-xs font-medium text-foreground">{label}</p>
            {hint && <p className="mb-2 text-[11px] text-foreground-secondary">{hint}</p>}
            {children}
        </div>
    );
}

function ToggleField({ label, hint, checked, onChange }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <p className="text-xs font-medium text-foreground">{label}</p>
                {hint && <p className="mt-0.5 text-[11px] text-foreground-secondary">{hint}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-black/[0.15] dark:bg-white/[0.15]"
                    }`}
            >
                <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform
                      ${checked ? "translate-x-4" : "translate-x-0.5"}`}
                />
            </button>
        </div>
    );
}

function StatBox({ label, value }) {
    return (
        <div className="rounded-md bg-black/[0.04] dark:bg-white/[0.05] px-2 py-2 text-center">
            <p className="text-sm font-semibold text-foreground">{value}</p>
            <p className="text-[10px] text-foreground-secondary">{label}</p>
        </div>
    );
}

function Notice({ children, icon: Icon = Info }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3">
            <Icon size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-200/80">
                {children}
            </p>
        </div>
    );
}