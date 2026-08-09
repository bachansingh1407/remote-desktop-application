# Ostrin Backend

Node.js + Express + PostgreSQL (Prisma) backend for Ostrin — full authentication
(access/refresh tokens, RBAC, lockout) and a file/folder system with strict
soft-delete semantics.

## Stack

- **Runtime:** Node.js 18+, Express 4
- **DB:** PostgreSQL, via Prisma ORM
- **Auth:** bcryptjs (hashing), jsonwebtoken (access tokens), opaque
  SHA-256-hashed refresh tokens with rotation + reuse detection
- **Validation:** Zod
- **Uploads:** Multer (disk storage)
- **Security:** helmet, cors, express-rate-limit, httpOnly cookies

## 1. Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` — point at your Postgres instance
- `ACCESS_TOKEN_SECRET` — generate with `openssl rand -hex 64`
- `CORS_ORIGIN` — your Next.js frontend URL (e.g. `http://localhost:3000`)

## 2. Database

```bash
npx prisma generate        # generates the Prisma client (needs network access)
npx prisma migrate dev     # creates tables from prisma/schema.prisma
npm run prisma:seed        # optional: creates a default ADMIN user (SEED_ADMIN_* in .env)
```

> If `prisma generate` fails to fetch its query engine binary, you're
> likely behind a restrictive proxy/firewall — `binaries.prisma.sh` needs
> to be reachable. This is unrelated to the app code.

## 3. Run

```bash
npm run dev     # nodemon, auto-restart
npm start       # production
```

Server boots on `http://localhost:5000` (or `PORT` from `.env`). Health check: `GET /api/health`.

## Architecture

```
src/
  config/        env parsing (fail-fast), Prisma client singleton, logger
  constants/     roles, node types, audit action names
  middlewares/   authenticate, authorize (RBAC), validate (Zod), rate limiters,
                 multer upload, centralized error handler
  validators/    Zod schemas per resource
  services/      business logic (auth, token rotation, node/file-tree, audit)
  controllers/   thin HTTP layer — req/res only, no business logic
  routes/        route wiring
  app.js         Express app (middleware stack)
  server.js      entrypoint + graceful shutdown
prisma/
  schema.prisma  DB models
  seed.js        optional admin user seeder
```

Layering rule: **controllers never touch Prisma directly** — they call into
`services/`, which is where all business rules and DB access live. This
keeps route handlers thin and testable in isolation from Express.

## Auth design

**Access token** — short-lived (15m default) JWT, sent in
`Authorization: Bearer <token>`. Never stored server-side; validity is pure
signature + expiry. `authenticate` middleware also re-checks the user's
`isActive` flag against the DB, so a disabled account is locked out
immediately rather than waiting for the JWT to expire.

**Refresh token** — deliberately *not* a JWT. It's a 64-byte random opaque
string. The raw value goes to the client exactly once, as an
`httpOnly`/`secure`/`sameSite` cookie scoped to `/api/auth`. Only its
SHA-256 hash is stored in `refresh_tokens`. This means a database leak
alone can't be used to forge a session, and revocation is instant (no
waiting on JWT expiry).

**Rotation + reuse detection** — every `POST /api/auth/refresh` call
consumes the current refresh token and issues a new one in the same
"family" (a UUID shared across all tokens from one login session). If a
*revoked* token is ever presented again, that's treated as a signal of
token theft — the entire family is revoked, forcing re-login everywhere.

**Lockout** — enforced server-side (`MAX_LOGIN_ATTEMPTS` /
`LOCKOUT_DURATION_MINUTES` in `.env`), independent of and in addition to
IP-based rate limiting on `/api/auth/*`. The frontend's existing lockout
UI is cosmetic; this is the real gate.

## File system design

Every file/folder is a row in `nodes`, self-referencing via `parentId`.

- **Soft delete is the only delete.** `trashNode` cascades `trashed=true`
  through the whole subtree. `deleteForever` and `emptyTrash` are the only
  paths to a real DB row deletion, and both require `trashed=true` first —
  there's no route that hard-deletes a live item.
- **Subtree operations use `WITH RECURSIVE` CTEs** (`getSubtreeIds`,
  `getPath`) instead of walking the tree with N+1 queries in JS. Backed by
  indexes on `(ownerId, parentId)` and `(parentId)`.
- **Restore is cascade-aware**: restoring a folder brings back only the
  descendants whose parent is also being restored (processed in
  depth-order), and the root reattaches to its original parent if that
  folder still exists and isn't itself trashed — otherwise it lands at
  workspace root rather than failing.
- **Move prevents cycles**: you can't move a folder into itself or into
  one of its own descendants (checked via the same subtree query).
- **Duplicate is shallow** (matches the frontend's `useFileSystemStore`
  behavior) — copies the node, not its children. If it's an uploaded file,
  the underlying file on disk is physically copied too, so trashing one
  copy doesn't orphan the other's pointer.

## API Reference

All routes are prefixed with `/api` (configurable via `API_PREFIX`).

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | – | Create account, returns `{ user, accessToken }`, sets refresh cookie |
| POST | `/login` | – | Returns `{ user, accessToken }`, sets refresh cookie |
| POST | `/refresh` | cookie | Rotates refresh token, returns new `{ accessToken }` |
| POST | `/logout` | Bearer | Revokes refresh token, clears cookie |
| GET | `/me` | Bearer | Current user |
| POST | `/change-password` | Bearer | Also revokes all other sessions |

### Files/Folders — `/api/nodes` (all require `Authorization: Bearer <token>`)

| Method | Path | Description |
|---|---|---|
| GET | `/tree` | Every node (any depth, any trash state) for the owner in one call — used by the frontend to hydrate its local cache on login |
| GET | `/?parentId=<uuid\|null>` | List children of a folder (or root) |
| GET | `/trash` | List trash-bin roots |
| DELETE | `/trash/empty` | Permanently delete everything in trash |
| GET | `/search?q=` | Search by name (non-trashed) |
| GET | `/stats` | File/folder counts, total size, trash count |
| POST | `/folder` | `{ parentId, name }` |
| POST | `/file` | `{ parentId, name, content }` |
| POST | `/import` | multipart `file` + `parentId` — uploads a real file |
| GET | `/:id/path` | Breadcrumb ancestry |
| GET | `/:id/download` | Streams an uploaded file |
| PATCH | `/:id/content` | `{ content }` — save a text file |
| PATCH | `/:id/rename` | `{ name }` |
| PATCH | `/:id/move` | `{ newParentId }` |
| POST | `/:id/duplicate` | Shallow copy |
| POST | `/:id/trash` | Soft-delete (cascades) |
| POST | `/:id/restore` | Restore from trash (cascades) |
| DELETE | `/:id` | Permanent delete — **requires already trashed** |

## Frontend integration notes

Your existing `useAuthStore` axios interceptor pattern (Bearer header +
`withCredentials: true` + `POST /auth/refresh` on 401) maps onto this
backend directly — no frontend contract changes needed, just point
`baseURL` at this server and swap the mock logic for real calls. The
`systemActionsStore` action list maps 1:1 onto the `/api/nodes/*` routes
above.

## What's intentionally out of scope for this first layer

- Object storage (S3/R2) for uploads — currently local disk under `uploads/`
- Full-text/fuzzy search (`pg_trgm` extension) — current search is `ILIKE`
- Email verification / password reset flows
- WebSocket/live sync between multiple sessions
- `CommandPalette` / `Toaster` wiring on the frontend (still empty stubs there)

Flag if you want any of these next — the audit log and RBAC groundwork
already here make most of them straightforward additions rather than
rework.
