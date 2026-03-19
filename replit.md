# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is the **VetStan Veterinary Dictionary Management System** backend API.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM + pg_trgm (GIN trigram indexes for fast ILIKE search)
- **Auth**: Custom JWT (HMAC-SHA256, no external libraries)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Security & Performance Hardening (applied)

- **Search**: Fixed broken column references (`word`/`kurdishMeaning` → `name`/`kurdish`), added type allowlist validation, added 200-char q length cap
- **Search**: 9 DB queries now run in parallel via `Promise.all` (was sequential)
- **List endpoints**: All 10 list routes run count + data queries in parallel via `Promise.all`
- **Upload**: Extension derived from MIME type (not attacker-controlled filename); magic-byte validation ensures declared MIME matches actual file bytes; SVG detection for XML content
- **Auth**: Email format regex + length validation; duplicate username AND email both checked before insert with clean 409 responses
- **Rate limiting**: Added write limiter (60 POST/PUT/PATCH/DELETE per minute per IP) on top of global (300/min) and auth (15/15min) limiters
- **Error handler**: Catches PostgreSQL error codes (23505 unique violation → 409, 23503 FK violation → 400, 23502 not-null → 400)
- **GIN indexes**: `pg_trgm` extension enabled; GIN trigram indexes on `words.name`, `words.kurdish`, `instruments.name`, `diseases.name`, `drugs.name` for fast ILIKE performance on 26K+ records
- **normalRanges**: Fixed missing parallel count+data queries and q-length validation (was missed in initial pass)
- **Login timing oracle**: Login now always runs a full PBKDF2 computation regardless of whether the username exists (via `verifyPasswordConstantTime`). Previously, a non-existent user skipped PBKDF2, making the response ~150ms faster — enough to enumerate valid usernames
- **Legacy weak password path removed**: The old single-iteration HMAC-SHA256 password fallback (from the Python backend migration) is eliminated. Any stored password not in pbkdf2 format is now rejected outright
- **Password max-length DoS guard**: Register and login both reject passwords longer than 1 024 chars before PBKDF2 runs; without this a single request with a ~900 KB password string would monopolise a worker thread
- **Production OpenAPI path fixed**: `docs.ts` used a `__dirname`-relative path that resolved correctly from `src/routes/` in dev but overshot the filesystem root when bundled into `dist/`; now uses `NODE_ENV`-aware resolution and `build.ts` copies `openapi.yaml` alongside `index.cjs` in the production bundle
- **`notifications.created_at` index**: Added a B-tree index so the default sort order query uses an index scan instead of a sequential scan
- **SVG uploads removed**: SVGs can contain `<script>` tags and inline event handlers. Serving them from the same origin with `Content-Type: image/svg+xml` makes them executable when loaded via `<embed>`, `<object>`, or direct navigation — a stored XSS risk. SVG also has no reliable magic bytes; the previous detection (look for `<svg` in first 512 bytes) was bypassed by any SVG with an XML declaration. Removed from allowed types entirely; JPEG, PNG, GIF, and WebP remain
- **`allowExitOnIdle` removed from DB pool**: This flag tells Node to unreference the pool's TCP sockets so they don't block event-loop exit — correct for CLI scripts, wrong for a server. Removed so the process only exits on an explicit signal
- **Upload error cleanup**: If the `createWriteStream` write fails after the file is created, the zero-byte/partial file is now deleted immediately rather than left on disk
- **JSON body type confusion fixed**: Auth routes now explicitly check `typeof` for `username`, `email`, and `password` before using them. Previously, passing a non-string (e.g. `"password":[1,2,3,4,5,6,7,8,9]`) would cause `hashPassword` to throw a TypeError resulting in a 500 — now returns a clean 400
- **Query param type confusion fixed**: All list and search routes used `req.query.x as string`, which silently accepted arrays (e.g. `?q=a&q=b` → `["a","b"]`) and objects, letting them bypass the 200-char length cap or be stringified into DB queries. A `toStr()` helper in `pagination.ts` now returns `undefined` for anything that isn't a plain string
- **Production `import.meta.url` crash fixed**: `docs.ts` called `fileURLToPath(import.meta.url)` unconditionally at module load time. In the CJS esbuild bundle `import.meta` is `{}` so this threw a TypeError before the server could start. Rewritten to use `process.cwd()` only, removing `import.meta.url` entirely — zero esbuild warnings, confirmed working in the production bundle

## API Endpoints (50+)

Base path: `/api`

### Auth
- `POST /auth/register` — Register user (returns JWT)
- `POST /auth/login` — Login (returns JWT)
- `GET /auth/me` — Get current user (requires Bearer token)

### Dictionary (Words)
- `GET /dictionary` — List with pagination & search (`?q=`, `?page=`, `?limit=`)
- `GET /dictionary/:id` — Get by ID
- `POST /dictionary` — Create (auth required)
- `PUT /dictionary/:id` — Update (auth required)
- `DELETE /dictionary/:id` — Delete (auth required)

### Diseases, Drugs, Books, Instruments, Notes
Same CRUD pattern as Dictionary for each module.
- Routes: `/diseases`, `/drugs`, `/books`, `/instruments`, `/notes`

### Tests (5 categories: haematology, serology, biochemistry, bacteriology, other)
- `GET /tests?category=haematology` — List with optional category filter
- `GET /tests/:id`, `POST /tests`, `PUT /tests/:id`, `DELETE /tests/:id`

### Slides (3 categories: urine, stool, other)
- `GET /slides?category=urine` — List with optional category filter
- `GET /slides/:id`, `POST /slides`, `PUT /slides/:id`, `DELETE /slides/:id`

### Normal Ranges
- `GET /normal-ranges?species=Dog&category=haematology`
- `GET /normal-ranges/:id`, `POST /normal-ranges`, `PUT /normal-ranges/:id`, `DELETE /normal-ranges/:id`

### About
- `GET /about/ceos`, `POST /about/ceos`, `PUT /about/ceos/:id`, `DELETE /about/ceos/:id`
- `GET /about/supporters`, `POST /about/supporters`, `PUT /about/supporters/:id`, `DELETE /about/supporters/:id`

### Upload
- `POST /upload/image` — Upload image (multipart/form-data, auth required)
- Uploaded files served at `/api/uploads/<filename>`

### Search
- `GET /search?q=term&type=all` — Global search across all modules
- `type` can be: `all`, `dictionary`, `diseases`, `drugs`, `books`, `instruments`, `tests`, `slides`, `notes`, `normalRanges`

### Notifications
- `GET /notifications` — List notifications (paginated)
- `GET /notifications/:id`
- `POST /notifications` — Create (auth required)
- `PATCH /notifications/:id/read` — Mark as read (auth required)
- `DELETE /notifications/:id` — Delete (auth required)

## Database Tables

13 tables in PostgreSQL (seeded with real data from the old Python backend):
- `users` — isAdmin, totalPoints, todayPoints, photoUrl, googleId fields
- `words` — name/kurdish/arabic (26,256 records seeded)
- `diseases` — name/kurdish/symptoms/cause/control (53 records)
- `drugs` — with tradeNames/speciesDosages/contraindications/drugInteractions/withdrawalTimes (50 records)
- `books` — with coverUrl/downloadUrl/category (2 records)
- `instruments` — (181 records)
- `tests` — single table with category field (haematology/serology/bacteriology/other) (29 records)
- `slides` — single table with category field (urine/stool/other) (16 records)
- `notes` — (10 records)
- `normal_ranges` — with name/reference/note/panicLow/panicHigh (24 records)
- `notifications` — title/body/imageUrl/type/isRead (2 records)
- `ceos`, `supporters`

## Seed Script

Data is seeded from JSON files in `attached_assets/` (20 files from the old Python/FastAPI backend).
Run: `pnpm --filter @workspace/scripts run seed`
The seed script is at `scripts/src/seed.ts` and batch-inserts 500 records at a time using `onConflictDoNothing`.

## Auth

JWT tokens use HMAC-SHA256 (no external library). 7-day expiry.
Secret configured via `JWT_SECRET` env var (defaults to a fallback for dev).
Send as: `Authorization: Bearer <token>`

## Railway Deployment

Config file: `railway.toml` (root of project)
Node version pinned: `.node-version` → `20`

**Build command (Railway runs this):**
```
pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
```
- Compiles TypeScript → `artifacts/api-server/dist/index.cjs` (esbuild, CJS, minified)
- Copies `lib/api-spec/openapi.yaml` → `artifacts/api-server/dist/openapi.yaml`

**Start command (Railway runs this):**
```
node artifacts/api-server/dist/index.cjs
```

**Required environment variables in Railway:**
| Variable | How to get it |
|---|---|
| `DATABASE_URL` | Add the Railway PostgreSQL plugin — it auto-sets this |
| `JWT_SECRET` | Set manually to a long random string (e.g. `openssl rand -hex 32`) |
| `PORT` | Auto-injected by Railway — do not set manually |

**After first deploy — seed the database:**
```
railway run pnpm --filter @workspace/scripts run seed
```
Or run the seed script from a Railway one-off task pointing at your production `DATABASE_URL`.

**Note on uploads:** The `uploads/` directory is written to the container filesystem, which is ephemeral in Railway. Files survive restarts but are lost on redeploy. For persistent uploads, replace the local write in `upload.ts` with an S3/R2 upload.

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
