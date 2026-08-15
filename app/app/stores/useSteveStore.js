import { create } from "zustand";
import { persist } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Achievement catalog. Kept as plain data (not scattered across every app)
// so SteveApp can render the whole grid from one source of truth, and so
// new achievements are a one-line add here + one unlock() call at the
// trigger site — nothing else needs to know the full list exists.
// ---------------------------------------------------------------------------
export const ACHIEVEMENTS = [
  {
    id: "first_hello",
    title: "Nice to meet you",
    description: "Said hello to Steve for the first time.",
    icon: "Hand",
  },
  {
    id: "explorer",
    title: "Getting the Lay of the Land",
    description: "Opened 3 different apps on the desktop.",
    icon: "Compass",
  },
  {
    id: "file_master",
    title: "Keeper of Files",
    description: "Opened the Files app.",
    icon: "FolderOpen",
  },
  {
    id: "wordsmith",
    title: "Wordsmith",
    description: "Opened Write and started a document.",
    icon: "NotebookPen",
  },
  {
    id: "coder",
    title: "Ships Code",
    description: "Opened Snippets to stash some code.",
    icon: "Code2",
  },
  {
    id: "planner",
    title: "Forward Planner",
    description: "Checked the Calendar.",
    icon: "Calendar",
  },
  {
    id: "community_voice",
    title: "Community Voice",
    description: "Pinned your first note on the Community wall.",
    icon: "Megaphone",
  },
  {
    id: "full_circle",
    title: "Full Circle",
    description: "Unlocked every other achievement. You basically live here now.",
    icon: "Trophy",
  },
];

// Which literal app-registry id maps to which single-open achievement.
const APP_ACHIEVEMENT_MAP = {
  files: "file_master",
  write: "wordsmith",
  snippets: "coder",
  calendar: "planner",
};

export const useSteveStore = create(
  persist(
    (set, get) => ({
      hasMetSteve: false,
      unlockedIds: [],
      // ids unlocked in the last few seconds — SteveApp uses this to play
      // the "just unlocked" glow, then it self-clears.
      recentlyUnlocked: [],
      openedApps: [],

      unlock: (id) => {
        const { unlockedIds } = get();
        if (unlockedIds.includes(id)) return;

        const next = [...unlockedIds, id];
        set({ unlockedIds: next, recentlyUnlocked: [...get().recentlyUnlocked, id] });

        setTimeout(() => {
          set((s) => ({ recentlyUnlocked: s.recentlyUnlocked.filter((x) => x !== id) }));
        }, 3000);

        // Meta-achievement: unlocking everything else unlocks this one too.
        const allOtherIds = ACHIEVEMENTS.map((a) => a.id).filter((a) => a !== "full_circle");
        const hasAllOthers = allOtherIds.every((a) => next.includes(a));
        if (hasAllOthers && !next.includes("full_circle")) {
          get().unlock("full_circle");
        }
      },

      completeFirstMeeting: () => {
        set({ hasMetSteve: true });
        get().unlock("first_hello");
      },

      // Called from the window manager whenever a genuinely new window is
      // opened (not a refocus of an existing one). Passive, no app needs
      // to know Steve exists.
      trackAppOpened: (appId) => {
        const { openedApps } = get();
        if (!openedApps.includes(appId)) {
          const next = [...openedApps, appId];
          set({ openedApps: next });
          if (next.length >= 3) get().unlock("explorer");
        }
        const mapped = APP_ACHIEVEMENT_MAP[appId];
        if (mapped) get().unlock(mapped);
      },

      isUnlocked: (id) => get().unlockedIds.includes(id),
    }),
    { name: "steve-storage" }
  )
);
