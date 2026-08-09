"use client";

import { useState } from "react";
import { Play, Trash2, Terminal as TerminalIcon, CheckCircle2, XCircle, Clock, HelpCircle, Wand2 } from "lucide-react";
import { useSystemActionsStore } from "@/app/stores/systemActionsStore";
import CommandGuidePanel from "@/app/components/common/CommandGuidePanel";

// Realistic example payloads for every action — shown in the help panel and
// used to one-click populate the params textarea, so people don't have to
// guess valid JSON shapes from the schema alone.
const EXAMPLES = {
  openApp: { appId: "files" },
  createFolder: { parentId: null, name: "Ideas" },
  createFile: { parentId: null, name: "notes.txt", content: "" },
  renameNode: { id: "<node-id>", name: "New name" },
  moveNode: { id: "<node-id>", newParentId: null },
  duplicateNode: { id: "<node-id>" },
  trashNode: { id: "<node-id>" },
  restoreNode: { id: "<node-id>" },
  deleteForever: { id: "<node-id>" },
  emptyTrash: {},
  searchNodes: { query: "budget" },
  getWorkspaceStats: {},
  openPath: { path: "Documents/Projects" },
  listFolder: { path: "Documents" },
};

export default function ToolConsoleApp() {
  const actions = useSystemActionsStore((s) => s.actions);
  const history = useSystemActionsStore((s) => s.history);
  const runAction = useSystemActionsStore((s) => s.runAction);
  const clearHistory = useSystemActionsStore((s) => s.clearHistory);

  const [selectedId, setSelectedId] = useState(actions[0]?.id ?? "");
  const [paramsInput, setParamsInput] = useState("{}");
  const [paramsError, setParamsError] = useState(null);
  const [result, setResult] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const selectedAction = actions.find((a) => a.id === selectedId);

  const helpSections = [
    {
      title: "Actions & examples",
      items: actions.map((a) => ({
        example: `${a.id} → ${JSON.stringify(EXAMPLES[a.id] ?? {})}`,
        description: a.description,
        actionId: a.id,
      })),
    },
  ];

  const fillExample = () => {
    setParamsInput(JSON.stringify(EXAMPLES[selectedId] ?? {}, null, 2));
    setParamsError(null);
  };

  const handleRun = async () => {
    let params = {};
    try {
      params = paramsInput.trim() ? JSON.parse(paramsInput) : {};
      setParamsError(null);
    } catch {
      setParamsError("Params isn't valid JSON");
      return;
    }
    const outcome = await runAction(selectedId, params);
    setResult(outcome);
  };

  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.06] text-foreground-secondary dark:bg-white/[0.08]">
            <TerminalIcon size={14} />
          </span>
          <div>
            <p className="text-xs font-semibold">Tool Console</p>
            <p className="text-[10px] text-foreground-secondary">Run any system action directly, with real params</p>
          </div>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          title="What can I run here?"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground-secondary hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
        >
          <HelpCircle size={15} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
      {/* left: action list */}
      <nav className="flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedId(a.id)}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors
              ${
                selectedId === a.id
                  ? "bg-accent/15 text-accent"
                  : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              }`}
          >
            <TerminalIcon size={13} strokeWidth={1.75} className="shrink-0" />
            <span className="truncate">{a.label ?? a.id}</span>
          </button>
        ))}
      </nav>

      {/* right: runner + history */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
        <div className="flex max-w-lg flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold">{selectedAction?.label ?? selectedAction?.id}</h2>
            <p className="mt-0.5 text-xs text-foreground-secondary">
              {selectedAction?.description}
            </p>
          </div>

          {selectedAction?.paramsSchema && Object.keys(selectedAction.paramsSchema).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium">Expected params</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(selectedAction.paramsSchema).map(([key, type]) => (
                  <code
                    key={key}
                    className="rounded border border-border bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-foreground-secondary"
                  >
                    {key}: {type}
                  </code>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium">Params (JSON)</p>
              <button
                onClick={fillExample}
                className="flex items-center gap-1 text-[10.5px] text-accent hover:underline"
              >
                <Wand2 size={11} /> Fill example
              </button>
            </div>
            <textarea
              value={paramsInput}
              onChange={(e) => {
                setParamsInput(e.target.value);
                setParamsError(null);
              }}
              rows={4}
              spellCheck={false}
              placeholder='{"name": "Test folder"}'
              className={`w-full rounded-md border bg-background-secondary/40 p-2 font-mono text-xs outline-none
                ${paramsError ? "border-red-500/50" : "border-border focus:border-accent/50"}`}
            />
            {paramsError && (
              <p className="mt-1 text-[11px] text-red-500">{paramsError}</p>
            )}
          </div>

          <button
            onClick={handleRun}
            className="flex w-fit items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs text-white hover:opacity-90"
          >
            <Play size={13} />
            Run action
          </button>

          {result && (
            <div>
              <p className="mb-1 text-xs font-medium">Result</p>
              <pre
                className={`overflow-auto rounded-md border p-2.5 text-[11px] leading-relaxed
                  ${
                    result.ok
                      ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                      : "border-red-500/25 bg-red-500/[0.06]"
                  }`}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* history */}
        <div className="mt-6 max-w-lg border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium">Run history</p>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 text-[11px] text-foreground-secondary hover:text-red-500"
              >
                <Trash2 size={11} />
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-[11px] text-foreground-secondary">
              No actions run yet — results will show up here.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {history.map((h) => (
                <div
                  key={h.runId}
                  className="flex items-center gap-2 rounded-md border border-border bg-background-secondary/30 px-2.5 py-1.5 text-[11px]"
                >
                  {h.result?.ok ? (
                    <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle size={13} className="shrink-0 text-red-500" />
                  )}
                  <span className="font-medium">{h.actionId}</span>
                  <span className="flex-1 truncate text-foreground-secondary">
                    {h.result?.message}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-foreground-secondary">
                    <Clock size={11} />
                    {new Date(h.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      <CommandGuidePanel
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Available actions"
        subtitle="Tap one to select it and load its example params"
        sections={helpSections}
        onPick={(example) => {
          const actionId = example.split(" → ")[0];
          setSelectedId(actionId);
          setParamsInput(JSON.stringify(EXAMPLES[actionId] ?? {}, null, 2));
          setParamsError(null);
          setHelpOpen(false);
        }}
      />
    </div>
  );
}