import { useMemo } from "react";
import {
    Settings,
    FolderOpen,
    NotebookPen,
    Calendar,
    Sparkles,
    Terminal,
    Trash2,
    ListChecks,
    Code2,
    Plug,
    Earth,
    Compass,
} from "lucide-react";
import SettingsApp from "@/app/apps/settings/SettingsApp";
import ToolConsoleApp from "../apps/tool-console/ToolConsoleApp";
import CalendarApp from "../apps/calendar/CalendarApp";
import AIAssistantApp from "../apps/ai-assistant/AIAssistantApp";
import BrowserApp from "../apps/browser/BrowserApp";
import FilesApp from "../apps/files/FilesApp";
import WriteApp from "../apps/write/WriteApp";
import TrashApp from "../apps/trash/TrashApp";
import TasksApp from "../apps/tasks/TasksApp";
import SnippetsApp from "../apps/snippets/SnippetsApp";
import IntegrationsApp from "../apps/integrations/IntegrationsApp";
import WebAppFrame from "../apps/web-app-frame/WebAppFrame";
import { useWebAppsStore } from "@/app/stores/useWebAppsStore";
import { getWebAppIcon } from "./webAppIcons";

export const APP_REGISTRY = [
    {
        id: "files",
        title: "Files",
        icon: FolderOpen,
        color: "#0FA37D",
        component: FilesApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 640,
        minHeight: 440
    },
    {
        id: "write",
        title: "Write",
        icon: NotebookPen,
        color: "#D6285F",
        component: WriteApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 600,
        minHeight: 440,
    },
    // {
    //     id: "tasks",
    //     title: "Tasks",
    //     icon: ListChecks,
    //     color: "#2563EB",
    //     component: TasksApp,
    //     pinned: true,
    //     showOnDesktop: true,
    //     comingSoon: false,
    //     width: 620,
    //     height: 520,
    //     minWidth: 460,
    //     minHeight: 380,
    // },
    {
        id: "snippets",
        title: "Snippets",
        icon: Code2,
        color: "#8B5CF6",
        component: SnippetsApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 560,
        minHeight: 400,
    },
    {
        id: "calendar",
        title: "Calendar",
        icon: Calendar,
        color: "#D97F0A",
        component: CalendarApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 300,
        minHeight: 400,
    },
    {
        id: "core-assistent", // or a dedicated "ai-assistant" id — see note below
        title: "akaza",
        icon: Sparkles,
        color: "#0FA35C",
        component: AIAssistantApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 600,
        minHeight: 440,
    },
    {
        id: "tool-console",
        title: "Tool Console",
        icon: Terminal,
        color: "#4A5568",
        component: ToolConsoleApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 620,
        minHeight: 440,
    },
    {
        id: "trash",
        title: "Trash",
        icon: Trash2,
        color: "#C22B26",
        component: TrashApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 480,
        minHeight: 360,
    },
    {
        id: "integrations",
        title: "Integrations",
        icon: Plug,
        color: "#0891B2",
        component: IntegrationsApp,
        pinned: true,
        showOnDesktop: true,
        comingSoon: false,
        width: 1000,
        height: 560,
        minWidth: 480,
        minHeight: 420,
    },
    {
        id: "settings",
        title: "Settings",
        icon: Settings,
        color: "#4A5568",
        component: SettingsApp,
        pinned: true,
        showOnDesktop: true,
        width: 1000,
        height: 560,
        minWidth: 700,
        minHeight: 500,
    },
    // {
    //     id: "browser",
    //     title: "Browser",
    //     icon: Compass,
    //     color: "#2d468c",
    //     component: BrowserApp,
    //     pinned: true,
    //     showOnDesktop: true,
    //     width: 1000,
    //     height: 560,
    //     minWidth: 700,
    //     minHeight: 500,
    // },
];

// Turns a stored integration (plain, serializable — see useWebAppsStore)
// into the same shape every built-in entry above has, so every existing
// consumer of APP_REGISTRY (desktop grid, taskbar, start menu, command
// palette, window titlebar) can render it without knowing it's different.
function toAppShape(webApp) {
    return {
        id: webApp.id,
        title: webApp.name,
        icon: getWebAppIcon(webApp.iconKey),
        color: webApp.color,
        component: () => <WebAppFrame url={webApp.url} name={webApp.name} />,
        pinned: false,
        showOnDesktop: true,
        comingSoon: false,
        isWebApp: true,
        width: 1000,
        height: 560,
        minWidth: 480,
        minHeight: 360,
    };
}

// Non-reactive snapshot — safe to call from anywhere (stores, event
// handlers) but won't trigger a re-render when a new integration is added.
export function getAllApps() {
    return [...APP_REGISTRY, ...useWebAppsStore.getState().webApps.map(toAppShape)];
}

// Reactive version for use inside components (desktop grid, start menu,
// command palette) so a newly added integration appears immediately
// without needing a manual refresh.
export function useAllApps() {
    const webApps = useWebAppsStore((s) => s.webApps);
    return useMemo(
        () => [...APP_REGISTRY, ...webApps.map(toAppShape)],
        [webApps]
    );
}

export function getApp(id) {
    return getAllApps().find((a) => a.id === id);
}