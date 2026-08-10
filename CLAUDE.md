# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

E-SPPTG is a digital land-registration system for Indonesian local government: officials process citizen land claims (pengajuan) through a multi-step workflow, validate boundaries against prohibited areas with PostGIS, and issue official SPPTG certificates as PDFs. UI text and domain vocabulary are Indonesian — see the glossary in AGENTS.md, which also documents known bugs, incomplete features, and detailed endpoint/schema tables.

## Commands

Use **pnpm** (lockfile is `pnpm-lock.yaml`).

```bash
pnpm dev                # Next.js dev server (http://localhost:3000)
pnpm build              # Production build (also serves as the type check)
pnpm lint               # ESLint (eslint-config-next + unused-imports)
pnpm test               # All unit tests (Vitest, node environment)
pnpm vitest run src/lib/kmz-parser.test.ts   # Single test file
```

Vitest only picks up `src/**/*.test.ts`; tests are colocated with the code (mostly pure-logic modules in `src/lib/` and `src/server/s3/`). Vitest globals are enabled — no `describe`/`it`/`expect` imports needed.

Database (Drizzle Kit, per-environment configs):

```bash
pnpm generate:stag / generate:prod   # Generate migrations into drizzle-stag/ or drizzle-prod/
pnpm migrate:stag / migrate:prod     # Run migrations (preferred over push for existing envs)
pnpm push:stag / push:prod           # Push schema directly (can fail on PostGIS typmod conflicts)
```

## Environment & infrastructure

- The env file is `.env.development.local` (gitignored via `.env*`) — loaded automatically by Next.js and explicitly by `stag.drizzle.config.ts`; `prod.drizzle.config.ts` loads `.env.development.prod`. There is no committed template; required keys are listed in AGENTS.md under "Environment Variables".
- **Database is PlanetScale Postgres** (`*.pg.psdb.cloud`, region ap-southeast-2/Sydney) with PostGIS 3.5. Two URLs to the same database: `DATABASE_URL` (port 6432, connection pooler — app runtime via `src/server/db/db.ts`) and `DATABASE_URL_DDL` (port 5432, direct connection — drizzle-kit only; DDL must not go through the pooler). Drizzle configs fail fast if `DATABASE_URL_DDL` is missing.
- **Object storage is Biznet NEO** (`nos.jkt-1.neo.id`, Jakarta), S3-compatible. The `AWS_*` env vars are NEO credentials, not real AWS — the name comes from `@aws-sdk/client-s3`.
- `import 'dotenv/config'` in `db.ts` reads `.env` (which doesn't exist), so code touching the DB outside Next.js (Vitest, standalone scripts) must inject env manually, e.g. `dotenv.config({ path: '.env.development.local' })`.

## Application flow

1. **Login & registration**: Authentication is the app's own — email + scrypt password hash, server-side `sessions` rows keyed by the SHA-256 of an HttpOnly cookie (`src/server/auth/`). `src/proxy.ts` gates `/app/*` on cookie presence only (Edge, no DB); `/api/trpc` stays open so login/register/reset are reachable. Self-registration always creates a `Viewer`; admins create accounts from Pengaturan, which always mails an invite link (there is no initial-password option) — opening it sets the first password and verifies the address in one step. Roles (`peran`) — five of them: `Superadmin` (everything), `Admin`/`Verifikator` (scoped to their `assigned_village_id`), `Kecamatan` (**read-only** oversight of every desa in its `assigned_kecamatan`; takes no part in the workflow — no drafts, no comments, no status or validity changes), `Viewer` (own drafts only, Step 1 only).
2. **4-step submission wizard** (`src/components/SubmissionFlow.tsx` + `submission-steps/Step1…Step4`). In-progress data lives as JSONB in `submission_drafts.payload`, validated per step by Zod schemas in `src/lib/validation/submission-draft.ts`, saved via `drafts.saveStep`:
   - **Step 1 — Berkas**: pick desa, applicant data (nama, NIK, alamat), upload mandatory KTP + KK plus supporting documents.
   - **Step 2 — Lapangan**: land boundary coordinates (geografis/UTM, map polygon drawing, or KML/KMZ import), area, boundary witnesses (saksi), survey team (juru ukur).
   - **Step 3 — Hasil**: PostGIS overlap check against `prohibited_areas`, then the verifier picks a status decision (see lifecycle below).
   - **Step 4 — Terbitkan SPPTG**: enter the certificate number, render the 4-page SPPTG PDF (react-pdf, `src/components/pdf/`), upload it to S3 as a `SPPG`-category document. Reachable from **two** decisions, and which one changes the whole stage — see "Two certificates" below.
3. **Final submit**: `submissions.submitDraft` converts the draft into a permanent `submissions` row — `owner_user_id` (draft creator), `verifikator` (processor), `geom` (PostGIS polygon, SRID 4326), and the Step 3 status (default `'SPPTG terdata'`).
4. **Post-submit**: dashboard (per-status KPIs, filters, map). Status can still change via `submissions.updateStatus` (verifikator+); every change is recorded in `status_history` / `riwayat` as an audit trail.

## SPPTG status lifecycle (`status_spptg` enum)

| Status | Meaning | Rules in code |
|---|---|---|
| `SPPTG terdata` | Recorded, **no approval** — the initial/default status; may still be issued its own certificate | Applied by `submitDraft` when the draft has no valid status. Reaches Step 4 and issues the *terdata* certificate |
| `SPPTG terdaftar` | **Approved** — passed verification, officially registered; prerequisite for Step 4 issuance | Choosing it when PostGIS found overlaps triggers a confirmation warning (`Step3Results.tsx`) |
| `SPPTG ditinjau ulang` | **Needs revision** — returned to applicant | Feedback/reason **required**; may attach `Lampiran Feedback` documents |
| `SPPTG ditolak` | **Rejected** permanently | Feedback/reason **required** |
| `Terbit SPPTG` | Certificate **issued** — intended final state | ⚠️ **Never actually set by any code path**: `submitDraft` whitelists only the other four statuses, Step 4 generates the PDF without changing status, and `StatusBadge.tsx` excludes it from its config. "Issued" is currently only observable via the certificate number + uploaded `SPPG` PDF document |

`terdata` vs `terdaftar` is the confusing pair: `terdata` = "in the system, awaiting decision"; `terdaftar` = "approved".

## Architecture

**Stack**: Next.js 16 App Router, React 19, tRPC v11, Drizzle ORM on PostgreSQL + PostGIS, self-hosted auth (scrypt + DB sessions), Tailwind 4 + shadcn/ui, S3-compatible storage, Google Maps (`@vis.gl/react-google-maps`), `@react-pdf/renderer` for certificates, nodemailer over Gmail SMTP for password-reset mail, Zod v4.

**Request path**: `src/proxy.ts` (Edge session-cookie gate) → tRPC handler at `src/app/api/trpc/[trpc]/route.ts` → routers in `src/trpc/routers/` (auth, drafts, documents, submissions, prohibitedAreas, villages, users) → query functions in `src/server/db/queries/`. The single Drizzle schema is `src/server/db/schema.ts`.

**Statistics API** (`/api/statistik`, `src/app/api/statistik/` + `src/server/public-api/`) is the one route family outside tRPC: read-only aggregate JSON for the Dashboard Eksekutif Kutai Timur. It authenticates on `X-Client-Id` / `X-API-Key` pairs from `STATISTIK_API_CLIENTS` (not sessions, not the DB), optionally restricts callers to `STATISTIK_API_ALLOWED_IPS`, and returns `503` when neither is configured — so it is off by default. It sends no CORS headers on purpose (server-to-server only) and must never expose applicant fields; see `docs/API-STATISTIK.md`.

**Public/SEO surface**: the landing page `/` is the *only* indexable route, and it is a **server component on purpose** — it renders `<LandingPage />` unconditionally so the prerendered HTML carries the real copy (`RedirectSignedInHome` is a null-rendering client safety net; `src/proxy.ts` already redirects signed-in visitors server-side). `src/lib/site.ts` holds the canonical origin and the private-path list that `robots.ts` and the per-page `noindex` both read; `sitemap.ts` and `opengraph-image.tsx` (generated card, no external assets) sit beside them. `/app/*` and `/api/*` also carry `X-Robots-Tag: noindex` from `next.config.ts`. If you make `/` client-gated again, the page silently drops out of search results — verify with `grep '<h1' .next/server/app/index.html` after a build.

**Audit trail** (`src/server/audit/` + `audit_logs` table, UI at Pengaturan → Audit Log). A middleware on `protectedProcedure` records **every authenticated mutation** — succeeded or failed — keyed by the tRPC procedure path, so a new mutation is audited without registering it anywhere. A procedure adds a before/after snapshot by calling `ctx.audit.set({ sebelum, sesudah, ringkasan, entitasId })`; without it the entry still lands, just with the (redacted) input instead. `redact()` strips anything whose key looks like a password/token/hash before it is stored — never bypass it by writing to `audit_logs` directly. Public auth procedures (login, register) sit below the middleware and call `recordAudit()` themselves; failed logins are recorded nowhere else. Every `audit.*` procedure is `superadminProcedure`, and deleting an entry is itself audited with the deleted entry's contents in the summary.

**Redis** (`src/server/redis/`) backs sessions, rate limiting and read caching. Every use goes through `withRedis()`, which returns a fallback when Redis is unreachable — so a cache outage degrades the app (slower, more Postgres reads) instead of breaking it, and `REDIS_URL` being unset is a supported local-dev configuration. Two rules when adding to it: **the user row is never cached without explicit invalidation** (`src/server/db/queries/user.ts` invalidates inside every write function, because `validateSessionToken` reads the user through that cache on every request — a miss means stale permissions), and **anything scoped per role uses `scopedKey()`**, which hashes the scope into the key so one role's dashboard numbers cannot be served to another. Sessions are written to both Redis and Postgres: Redis serves every request, Postgres is the durable copy that survives a Redis restart and still powers "perangkat aktif".

**Authentication** lives in `src/server/auth/`: `password.ts` (scrypt hash/verify), `session.ts` (create/validate/revoke, 30-day sliding expiry), `cookies.ts` (`espptg_session`, HttpOnly/Lax/Secure), `password-reset.ts` (single-use 1-hour tokens), `mailer.ts` (Gmail SMTP — the only third-party call left), `rate-limit.ts`. Only token *digests* reach the database. `users.password_hash` must never leave the server: every read procedure passes rows through `toClientUser`, which swaps it for a `hasPassword` boolean.

**Authorization is two-layered**:
1. Procedure middleware in `src/trpc/init.ts`: `publicProcedure` → `protectedProcedure` → `verifikatorProcedure` (Superadmin/Admin/Verifikator) → `adminProcedure` (Superadmin/Admin) → `superadminProcedure`. The role field is `appUser.peran`. `Kecamatan` clears only `protectedProcedure` — it is deliberately absent from every tier above, which is what makes it read-only.
2. Row-level scoping via `src/server/authz.ts` — reuse these helpers (`canAccessDraft`, `assertCanAccessSubmission`, `getSubmissionScopeForUser`, …) in routers rather than reimplementing checks. `submissions.owner_user_id` is the source of truth for Viewer visibility; `verifikator` is the processor, not the owner.
3. Document-category scoping, also in `authz.ts`: the oversight roles (`Superadmin`, `Kecamatan`) see **only the `SPPG` category** on a filed pengajuan — never the KTP, KK or any other berkas. Enforced server-side in `documentRouter` (`listBySubmission` filters, `getSignedDownloadUrl`/`getById` refuse) via `canViewSubmissionDocumentCategory`; `DetailPage` mirrors it so the UI explains the gap. Drafts are deliberately exempt — the wizard has to render its own uploads, and `Kecamatan` cannot reach a draft anyway.

Two submission-flow gotchas that have caused real data loss:
- On step transitions, the current step's data must be **explicitly saved before** updating `currentStep` — do not rely on auto-save intervals or unmount effects (race conditions).
- The payload passed to `saveDraftStep` is manually constructed; a field missing there silently never persists, even though local state looks correct.

**Notifications** are two layers over one event. The durable layer is the `notifications` table written by `createNotification` — read back scoped-by-role in `listNotificationsScoped` and polled every 30s by `NotificationBell`. On top of it, **Web Push** (`src/server/push/`) delivers the same event to the browser and the installed PWA: `push_subscriptions` holds one row per browser endpoint, `webpush.ts` signs with VAPID (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`), and `public/sw.js` renders the notification. Three rules: push follows the `withRedis()` pattern — **unset VAPID keys are a supported configuration**, the whole thing no-ops and the bell still works; `pushSubmissionEvent` is called **after the transaction commits**, never inside it, so a rollback cannot notify people about a pengajuan that does not exist; and `listNotificationRecipientUserIds` must keep mirroring `listNotificationsScoped`, or someone gets pushed a pengajuan they cannot open. Events wired up today: `submissions.submitDraft` (created/updated) and `submissions.updateStatus` (status).

**Spatial analysis**: `src/server/postgis.ts` runs raw PostGIS queries (`ST_Intersects`/`ST_Intersection`/`ST_Area`) to check submission polygons against `prohibited_areas.geom` (protected zones: Kawasan Hutan, Tanah Pemerintah, Sempadan Sungai, … — the 14 values live in `src/lib/prohibited-area-types.ts`, the single source for the pgEnum, the TS union, the Zod schema and every dropdown); results are cached in `overlap_results`. Coordinate/GeoJSON/UTM helpers live in `src/lib/` (`map-utils.ts`, `utm-conversion.ts`), with KMZ/KML **import** in `kmz-parser.ts` and the matching **export** (detail page → "Unduh Peta Lahan") in `kml-export.ts`.

**File storage**: uploads go client → base64 → `documents.uploadFile` → S3 (`src/server/s3/s3.ts`), keyed `submissions/{category}/{timestamp}-{randomId}-{filename}`. Official form templates live at `template-documents/{filename}`, fetched via `documents.getTemplateUrl` (signed URL) or `documents.fetchTemplatePDF` (base64).

**PDF generation**: SPPTG certificates are rendered with react-pdf components in `src/components/pdf/`, with data mapping in `src/lib/spptg-pdf-data.ts` and `src/lib/pdf-generator.ts`.

**Two certificates** — Step 4 issues a different document depending on the Step 3 decision, and the difference is the point, not a cosmetic variant:

| | `SPPTG terdaftar` | `SPPTG terdata` |
|---|---|---|
| Nomor prefix | `TERDAFTAR/SPPTG/` | `TERDATA/SPPTG/` (`src/lib/nomor-spptg.ts`; the prefix is a fixed label beside the input, never part of its value, and `hasNomorSPPTGBody` is what "filled in" means) |
| Kepala Desa endorsement | printed | **dropped** — no desa signs off on contested land |
| Disclosure notice | none | yellow `TerdataNotice` block: a 13-row checklist of jenis kawasan, ticked from `overlapResults`, signed by the juru ukur |
| Softcopy | uploaded by hand | **generated and attached automatically**; the issue button only appears once it exists |
| Overlap rule | *any* overlap shuts Step 4 | only a clash with **another pengajuan** blocks; kawasan overlaps are disclosed on the notice instead |

The split lives in `src/lib/spptg-terdata.ts` (`blockingSubmissionOverlaps`, `checkedTerdataStatuses`) and is selected by `data.variant` inside the PDF. Two things that look tempting and are wrong: `deriveSubmissionStatus` must **not** promote an issued terdata berkas to `terdaftar` (the status would contradict the paper it just produced), and the terdata certificate stays in the `SPPG` document category so oversight roles keep seeing it — a separate category would be a second grant to forget.

## Gotchas

- Legacy mixed-case column: the submissions village column is `submissions."villageId"` — raw SQL and index definitions must quote it exactly.
- Drizzle configs exclude PostGIS system tables via `tablesFilter: ['!geography_columns', '!geometry_columns']` and `extensionsFilters: ["postgis"]` — keep these when editing the configs.
- Status enum values use the `SPPTG` prefix (`'SPPTG terdata'`, `'Terbit SPPTG'`, …); some older UI code uses a wrong `SKT` prefix (see Known Issues in AGENTS.md).
- If new authz columns are missing from a database, authenticated pages fail with HTTP 500 on `auth.me` / `drafts.getById`.
