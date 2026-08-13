import { create } from "zustand";
import { persist } from "zustand/middleware";

let idCounter = 1;
const nextId = () => `webapp-${Date.now()}-${idCounter++}`;

// Users type things like "myapp.vercel.app" as often as a full URL —
// treat a missing scheme as https rather than rejecting it.
function normalizeUrl(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Not backed by the server yet — these are per-browser integrations the
// user wires up themselves (their own hosted tools, mostly), so
// localStorage persistence is the right amount of durability for now
// without needing a new Prisma model + API routes.
export const useWebAppsStore = create(
  persist(
    (set, get) => ({
      webApps: [],

      addWebApp: ({ name, url, iconKey, color }) => {
        const app = {
          id: nextId(),
          name: (name ?? "").trim(),
          url: normalizeUrl(url),
          iconKey: iconKey || "globe",
          color: color || "#7C3AED",
          createdAt: Date.now(),
        };
        set((s) => ({ webApps: [...s.webApps, app] }));
        return app;
      },

      updateWebApp: (id, patch) => {
        set((s) => ({
          webApps: s.webApps.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...patch,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                  ...(patch.url !== undefined ? { url: normalizeUrl(patch.url) } : {}),
                }
              : a
          ),
        }));
      },

      removeWebApp: (id) => {
        set((s) => ({ webApps: s.webApps.filter((a) => a.id !== id) }));
      },

      getWebApp: (id) => get().webApps.find((a) => a.id === id),
    }),
    { name: "webapps-storage" }
  )
);