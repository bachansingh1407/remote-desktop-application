"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, ExternalLink, Check, X, AppWindow } from "lucide-react";
import { useWebAppsStore } from "@/app/stores/useWebAppsStore";
import { useWindowStore } from "@/app/stores";
import { toast } from "@/app/stores/useToastStore";
import { WEB_APP_ICON_OPTIONS, WEB_APP_COLORS, getWebAppIcon } from "@/app/lib/webAppIcons";
import WebAppFrame from "@/app/apps/web-app-frame/WebAppFrame";

const EMPTY_FORM = { name: "", url: "", iconKey: "globe", color: WEB_APP_COLORS[0] };

// A URL a user is comfortable pasting in a search bar — "myapp.dev",
// "myapp.dev/path", "localhost:3000" — without demanding a scheme.
const LOOSE_URL_RE = /^([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/.*)?$|^localhost(:\d+)?(\/.*)?$/i;

function chipStyle(color) {
  return {
    background: `color-mix(in srgb, ${color} 14%, var(--background-secondary))`,
    color,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 24%, transparent)`,
  };
}

export default function IntegrationsApp() {
  const webApps = useWebAppsStore((s) => s.webApps);
  const addWebApp = useWebAppsStore((s) => s.addWebApp);
  const updateWebApp = useWebAppsStore((s) => s.updateWebApp);
  const removeWebApp = useWebAppsStore((s) => s.removeWebApp);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  const sorted = useMemo(
    () => [...webApps].sort((a, b) => a.name.localeCompare(b.name)),
    [webApps]
  );

  const openAddForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setFormOpen(true);
  };

  const openEditForm = (app) => {
    setEditingId(app.id);
    setForm({ name: app.name, url: app.url, iconKey: app.iconKey, color: app.color });
    setError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const url = form.url.trim();
    if (!name) return setError("Give the app a name.");
    if (!url) return setError("Enter the app's URL.");
    if (!LOOSE_URL_RE.test(url.replace(/^https?:\/\//i, ""))) {
      return setError("That doesn't look like a valid URL.");
    }

    if (editingId) {
      updateWebApp(editingId, form);
      toast.success("Integration updated", name);
    } else {
      addWebApp(form);
      toast.success("Integration added", `${name} is now on your desktop`);
    }
    closeForm();
  };

  const handleDelete = (app) => {
    if (window.confirm(`Remove "${app.name}"? This won't affect the site itself.`)) {
      removeWebApp(app.id);
      toast.info("Integration removed", app.name);
    }
  };

  const handleOpen = (app) => {
    openWindow({
      id: app.id,
      title: app.name,
      content: <WebAppFrame url={app.url} name={app.name} />,
      width: 900,
      height: 620,
      minWidth: 480,
      minHeight: 360,
    });
  };

  const PreviewIcon = getWebAppIcon(form.iconKey);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-background-elevated px-4 py-3">
        <div>
          <h1 className="text-[13.5px] font-semibold text-foreground">Integrations</h1>
          <p className="text-[11.5px] text-foreground-secondary/70">Add any web app by URL — it shows up as its own icon on your desktop.</p>
        </div>
        {!formOpen && (
          <button
            onClick={openAddForm}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors hover:bg-accent/90"
          >
            <Plus size={14} strokeWidth={2.25} />
            Add app
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {formOpen && (
          <form onSubmit={handleSubmit} className="animate-fade-in mb-5 flex flex-col gap-4 rounded-xl border border-border bg-background-elevated p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[12.5px] font-semibold text-foreground">{editingId ? "Edit app" : "New app"}</h2>
              <button type="button" onClick={closeForm} className="flex h-6 w-6 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
                <X size={13} />
              </button>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-1 flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-foreground-secondary">Name</span>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="enter app name"
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-accent/50 focus:ring-[3px] focus:ring-accent/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium text-foreground-secondary">URL</span>
                  <input
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="enter enternal url"
                    className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-accent/50 focus:ring-[3px] focus:ring-accent/10"
                  />
                </label>
                {error && <p className="text-[11.5px] text-red-500">{error}</p>}
              </div>

              {/* live preview — exactly how the desktop icon will render */}
              <div className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-background p-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[11px]" style={chipStyle(form.color)}>
                  <PreviewIcon size={19} strokeWidth={1.75} />
                </span>
                <span className="line-clamp-2 text-center text-[10.5px] font-medium leading-tight text-foreground">
                  {form.name || "App name"}
                </span>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-foreground-secondary">Icon</span>
              <div className="flex flex-wrap gap-1.5">
                {WEB_APP_ICON_OPTIONS.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, iconKey: key }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors
                      ${form.iconKey === key ? "border-accent/50 bg-accent/10 text-accent" : "border-border text-foreground-secondary hover:bg-foreground/[0.05] hover:text-foreground"}`}
                  >
                    <Icon size={15} strokeWidth={1.85} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-medium text-foreground-secondary">Color</span>
              <div className="flex flex-wrap gap-2">
                {WEB_APP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    title={c}
                    style={{
                      background: c,
                      boxShadow: form.color === c
                        ? `0 0 0 2px var(--background-elevated), 0 0 0 4px ${c}`
                        : "inset 0 0 0 1px rgba(0,0,0,0.08)",
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
                  >
                    {form.color === c && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button type="button" onClick={closeForm} className="rounded-md px-3 py-1.5 text-[12.5px] font-medium text-foreground-secondary transition-colors hover:bg-foreground/[0.05] hover:text-foreground">
                Cancel
              </button>
              <button type="submit" className="rounded-md bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-accent/90">
                {editingId ? "Save changes" : "Add app"}
              </button>
            </div>
          </form>
        )}

        {sorted.length === 0 && !formOpen ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground/[0.04] text-foreground-secondary/45">
              <AppWindow size={22} strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-foreground-secondary">No integrations yet</p>
              <p className="mt-1 max-w-[280px] text-[11.5px] text-foreground-secondary/55">
                Add a URL to any web app you&apos;ve built or use — it&apos;ll appear as its own icon on the desktop.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sorted.map((app) => {
              const Icon = getWebAppIcon(app.iconKey);
              return (
                <div key={app.id} className="group flex items-center gap-3 rounded-lg border border-border bg-background-elevated px-3 py-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={chipStyle(app.color)}>
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{app.name}</p>
                    <p className="truncate text-[11px] text-foreground-secondary/60">{app.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => handleOpen(app)} title="Open" className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
                      <ExternalLink size={13} />
                    </button>
                    <button onClick={() => openEditForm(app)} title="Edit" className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(app)} title="Remove" className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-red-500/10 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}