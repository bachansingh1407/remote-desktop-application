"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import ProtectedRoute from "./lib/utils/ProtectedRoute";
import WindowManager from "./components/common/WindowManager";
import Taskbar from "./components/desktop/Taskbar";
import { useAuthStore, useSettingsStore, useThemeStore, useFileSystemStore } from "./stores";
import DesktopIconGrid from "./components/desktop/DesktopIconGrid";
import WallpaperLayer from "./components/desktop/WallpaperLayer";
import { ContextMenuProvider } from "./components/common/ContextMenu";
import Toaster from "./components/common/Toaster";
import CommandPalette from "./components/common/CommandPalette";
import SteveWidget from "./components/desktop/SteveWidget";

export default function Providers({ children }) {
  const pathname = usePathname();
  const initializeTheme = useThemeStore((s) => s.initializeTheme);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const initializeSettings = useSettingsStore((s) => s.initializeSettings);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const hydrateFiles = useFileSystemStore((s) => s.hydrate);
  const isFilesHydrated = useFileSystemStore((s) => s.isHydrated);
  const clearFilesCache = useFileSystemStore((s) => s.clearCache);

  useEffect(() => {
    initializeTheme();
    initializeAuth();
    initializeSettings();
    // Intentionally run once on mount only — these are one-time
    // initializers, not values this effect should re-run in response to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loads the workspace tree the moment we have a confirmed session —
  // whether that came from a fresh login or a silently-restored refresh
  // cookie on boot — and clears the cache again on logout so a future
  // login never starts from stale/previous-session data.
  useEffect(() => {
    if (isAuthenticated && !isFilesHydrated) {
      hydrateFiles();
    }
    if (!isAuthenticated) {
      clearFilesCache();
    }
  }, [isAuthenticated, isFilesHydrated, hydrateFiles, clearFilesCache]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        Loading...
      </div>
    );
  }

  const isAuthRoute = pathname === "/login" || pathname === "/register";

  return (
    <ProtectedRoute>
      {isAuthRoute ? (
        children
      ) : (
        <ContextMenuProvider>
          <WallpaperLayer />
          {children}
          <DesktopIconGrid />
          <WindowManager />
          <CommandPalette />
          <Toaster />
          <SteveWidget />
          <Taskbar />
        </ContextMenuProvider>
      )}
    </ProtectedRoute>
  );
}
