# Ostrin Frontend — Backend Integration Notes

This frontend now talks to the real Ostrin backend (see `../backend`)
instead of the in-memory mock stores it shipped with originally.

## Setup

```bash
npm install
cp .env.local.example .env.local   # points at your backend, defaults to localhost:5000
npm run dev
```

The backend must be running first (`cd ../backend && npm run dev`), and
you need an actual user account in its database before you can log in —
there's no public sign-up screen (matches the app's original single-user
security posture). Create your account one of two ways:

1. **Seed script** (recommended): set `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD` in `backend/.env`, then `npm run prisma:seed` —
   log in with those credentials.
2. **Once via `POST /api/auth/register`** with curl/Postman/Thunder
   Client, then just log in normally from then on.

## What changed

| File | Change |
|---|---|
| `lib/axios.js` | Fixed a broken relative import (`./stores/...` → `../stores/...`) that would've crashed on first use. Added `fetchFileDataUrl()` for authenticated file downloads. |
| `stores/useAuthStore.js` | Real `login`/`logout`/`initializeAuth`/`changePassword` against `/api/auth/*`. Server is authoritative on lockout; local counters are cosmetic only. |
| `stores/useFileSystemStore.js` | See "Architecture decision" below. |
| `stores/systemActionsStore.js` | `runAction`/`executeAction` are now `async` since the file-system actions they call hit a real API. |
| `apps/tool-console/ToolConsoleApp.jsx` | `handleRun` now awaits `runAction`. |
| `lib/mockAiEngine.js` | Awaits `runAction` calls. Still a regex "mock" assistant — swapping this for a real model call is a separate task. |
| `components/common/FileEditor.jsx` | Autosave now handles the async save call, with one retry and a visible "Save failed" state instead of assuming success. |
| `components/common/FileViewer.jsx` | Rewritten — fetches uploaded file bytes from `/api/nodes/:id/download` as a base64 data URL (needed because `<img>`/PdfViewer can't send the auth header themselves) instead of reading a mock `dataUrl` that no longer exists. |
| `apps/settings/SettingsApp.jsx` | Fixed a pre-existing bug — `resetFileSystem()` was called but never defined, so "Clear everything" would have thrown. Now implemented (trash + empty-trash everything). Storage estimate now uses real file sizes for uploads. |
| `components/auth/LoginPage.jsx` | Footer text corrected (no longer claims "no backend connected"). |
| `providers.jsx` | Hydrates the file-system cache once authenticated; clears it on logout. |

## Architecture decision: why the file store still looks synchronous

Every component built against the old mock (`FilesApp`, `TrashApp`,
`FileEditor`, `SettingsApp`, the AI assistant...) reads the tree
**synchronously** — `items[id]`, `Object.values(items)`, `getChildren()`.
A real backend is naturally lazy/paginated per folder, and rewriting every
one of those call sites to handle loading states is a much bigger job
than "wire up the backend."

So `useFileSystemStore` now **hydrates the entire tree into the same
`items` shape once, on login** (via a new `GET /api/nodes/tree` endpoint
I added to the backend), and every existing synchronous read keeps
working completely unmodified. Mutations (create, rename, move, trash...)
call the real API, then patch the local cache from the response — so for
single-tab, single-user usage the cache never drifts from server truth.

`restoreNode` is the one exception: its cascade rules (does a descendant
come back with it? does the root reattach to its old parent or fall back
to workspace root?) live in the backend and are genuinely non-trivial to
mirror client-side, so it just re-hydrates the whole tree from the server
after the call succeeds.

**This is a deliberate simplification for personal-workspace scale, not a
general pattern.** If this ever needs multi-tab sync or has to handle
thousands of nodes, switch to lazy per-folder fetches — the backend
already supports that via `GET /api/nodes?parentId=` — and add loading
states to the consuming components.

## Known limitations carried over from this integration

- **PDF annotation isn't persisted.** `PdfViewer`'s save flow updates what
  you see in the current session only — the backend doesn't yet have an
  endpoint to replace an uploaded file's bytes (only text-note `content`
  can be saved back). Add a `PUT /nodes/:id/replace` route + matching
  store action if you want this to survive a reload.
- **`mockAiEngine.js` is still a regex responder**, just now correctly
  awaiting real backend actions when it recognizes a command. Swapping it
  for an actual Claude API call is unrelated to this integration and was
  flagged as a separate follow-up in an earlier session.
- **`CommandPalette.jsx` / `Toaster.jsx`** are still empty stub files, not
  wired to anything — unrelated to this backend integration, flagged
  previously.

## Validation performed

- Every touched/created file passed an `esbuild` JSX syntax check and
  `eslint` with zero errors (one pre-existing `<img>` optimization
  warning remains, present before this integration too).
- `next build` was attempted but fails in this sandbox only because
  `fonts.googleapis.com` isn't reachable here — unrelated to any of these
  changes and will build fine with normal internet access.
