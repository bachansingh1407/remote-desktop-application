import {
  Globe, Link2, Boxes, Terminal, Database, Cloud, Send, Zap, Rocket,
  Package, Wrench, Compass, Layers, Server, GitBranch, Braces, Webhook,
  MonitorSmartphone, Gauge, ClipboardList, FlaskConical, Puzzle, LayoutGrid, Blocks,
} from "lucide-react";

// Curated icon set for the "add integration" picker — kept intentionally
// small and dev-tool flavored rather than exposing the entire lucide set.
export const WEB_APP_ICON_OPTIONS = [
  { key: "globe", icon: Globe },
  { key: "link", icon: Link2 },
  { key: "boxes", icon: Boxes },
  { key: "terminal", icon: Terminal },
  { key: "database", icon: Database },
  { key: "cloud", icon: Cloud },
  { key: "send", icon: Send },
  { key: "zap", icon: Zap },
  { key: "rocket", icon: Rocket },
  { key: "package", icon: Package },
  { key: "wrench", icon: Wrench },
  { key: "compass", icon: Compass },
  { key: "layers", icon: Layers },
  { key: "server", icon: Server },
  { key: "git-branch", icon: GitBranch },
  { key: "braces", icon: Braces },
  { key: "webhook", icon: Webhook },
  { key: "monitor", icon: MonitorSmartphone },
  { key: "gauge", icon: Gauge },
  { key: "clipboard", icon: ClipboardList },
  { key: "flask", icon: FlaskConical },
  { key: "puzzle", icon: Puzzle },
  { key: "grid", icon: LayoutGrid },
  { key: "blocks", icon: Blocks },
];

const WEB_APP_ICON_MAP = Object.fromEntries(
  WEB_APP_ICON_OPTIONS.map((o) => [o.key, o.icon])
);

export function getWebAppIcon(key) {
  return WEB_APP_ICON_MAP[key] ?? Globe;
}

// Same family of saturated, distinct hues the built-in apps use (see
// lib/appRegistry.js), so custom integrations sit naturally alongside
// Files/Write/Snippets on the desktop instead of clashing with them.
export const WEB_APP_COLORS = [
  "#7C3AED", "#0FA37D", "#D6285F", "#2563EB", "#D97F0A",
  "#8B5CF6", "#0891B2", "#DC2626", "#16A34A", "#DB2777",
];