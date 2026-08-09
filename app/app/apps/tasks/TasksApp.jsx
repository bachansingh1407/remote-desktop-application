"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, CheckCircle2, Circle, ListChecks, X, Pencil } from "lucide-react";
import { useTasksStore } from "@/app/stores";

export default function TasksApp() {
  const tasks = useTasksStore((s) => s.tasks);
  const addTask = useTasksStore((s) => s.addTask);
  const toggleTask = useTasksStore((s) => s.toggleTask);
  const editTask = useTasksStore((s) => s.editTask);
  const deleteTask = useTasksStore((s) => s.deleteTask);
  const clearCompleted = useTasksStore((s) => s.clearCompleted);
  const getLists = useTasksStore((s) => s.getLists);

  const [activeList, setActiveList] = useState("Inbox");
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("active"); // active | all | done
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const lists = getLists();

  const listTasks = useMemo(
    () => tasks.filter((t) => (t.list || "Inbox") === activeList),
    [tasks, activeList]
  );

  const visibleTasks = useMemo(() => {
    if (filter === "active") return listTasks.filter((t) => !t.done);
    if (filter === "done") return listTasks.filter((t) => t.done);
    return listTasks;
  }, [listTasks, filter]);

  const doneCount = listTasks.filter((t) => t.done).length;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    addTask(input, activeList);
    setInput("");
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditValue(t.title);
  };

  const commitEdit = () => {
    if (editingId) editTask(editingId, editValue);
    setEditingId(null);
  };

  return (
    <div className="flex h-full bg-background text-foreground">
      {/* lists sidebar */}
      <nav className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2">
        {lists.map((list) => {
          const count = tasks.filter((t) => (t.list || "Inbox") === list && !t.done).length;
          return (
            <button
              key={list}
              onClick={() => setActiveList(list)}
              className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors
                ${activeList === list ? "bg-accent/15 text-accent" : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}
            >
              <span className="truncate">{list}</span>
              {count > 0 && <span className="shrink-0 text-[10px] opacity-70">{count}</span>}
            </button>
          );
        })}
        <NewListButton onCreate={(name) => setActiveList(name)} />
      </nav>

      {/* main */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{activeList}</p>
            <p className="text-[11px] text-foreground-secondary">
              {doneCount}/{listTasks.length} complete
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-border p-0.5 text-[10.5px]">
            {["active", "all", "done"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-2 py-1 capitalize transition-colors
                  ${filter === f ? "bg-accent text-white" : "text-foreground-secondary hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAdd} className="flex shrink-0 items-center gap-2 border-b border-border p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Add a task to ${activeList}...`}
            className="flex-1 rounded-lg border border-border bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2 text-xs
                       text-foreground outline-none placeholder-foreground-secondary/60 focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white
                       hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} />
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {visibleTasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 text-foreground-secondary/60">
                <ListChecks size={20} />
              </span>
              <p className="text-xs text-foreground-secondary">
                {filter === "done" ? "Nothing completed yet" : "You're all caught up"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {visibleTasks.map((t) => (
                <div
                  key={t.id}
                  className="group flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <button onClick={() => toggleTask(t.id)} className="shrink-0 text-foreground-secondary">
                    {t.done ? <CheckCircle2 size={17} className="text-accent" /> : <Circle size={17} />}
                  </button>

                  {editingId === t.id ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 rounded border border-accent/50 bg-transparent px-1.5 py-0.5 text-[13px] outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => startEdit(t)}
                      className={`min-w-0 flex-1 truncate text-[13px] ${t.done ? "text-foreground-secondary line-through" : "text-foreground"}`}
                    >
                      {t.title}
                    </span>
                  )}

                  <button
                    onClick={() => startEdit(t)}
                    className="shrink-0 text-foreground-secondary/50 opacity-0 hover:text-foreground group-hover:opacity-100"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => deleteTask(t.id)}
                    className="shrink-0 text-foreground-secondary/50 opacity-0 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {doneCount > 0 && (
          <div className="flex shrink-0 items-center justify-end border-t border-border px-3 py-2">
            <button
              onClick={clearCompleted}
              className="text-[11px] text-foreground-secondary hover:text-red-500"
            >
              Clear completed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewListButton({ onCreate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs text-foreground-secondary/70 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
      >
        <Plus size={12} /> New list
      </button>
    );
  }

  const commit = () => {
    if (value.trim()) onCreate(value.trim());
    setEditing(false);
    setValue("");
  };

  return (
    <div className="flex items-center gap-1 px-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="List name"
        className="min-w-0 flex-1 rounded border border-accent/50 bg-transparent px-1.5 py-1 text-[11px] outline-none"
      />
      <button onClick={() => setEditing(false)} className="shrink-0 text-foreground-secondary/60">
        <X size={12} />
      </button>
    </div>
  );
}
