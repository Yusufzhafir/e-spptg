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

1. **Login & provisioning**: Users authenticate via Clerk (`src/proxy.ts` protects `/app/*` and `/api/*`). First login auto-creates a `users` row with role `Viewer`. Roles (`peran`): `Superadmin` (everything), `Admin`/`Verifikator` (scoped to their `assigned_village_id`), `Viewer` (own drafts only, Step 1 only).
2. **4-step submission wizard** (`src/components/SubmissionFlow.tsx` + `submission-steps/Step1…Step4`). In-progress data lives as JSONB in `submission_drafts.payload`, validated per step by Zod schemas in `src/lib/validation/submission-draft.ts`, saved via `drafts.saveStep`:
   - **Step 1 — Berkas**: pick desa, applicant data (nama, NIK, alamat), upload mandatory KTP + KK plus supporting documents.
   - **Step 2 — Lapangan**: land boundary coordinates (geografis/UTM, map polygon drawing, or KML/KMZ import), area, boundary witnesses (saksi), survey team (juru ukur).
   - **Step 3 — Hasil**: PostGIS overlap check against `prohibited_areas`, then the verifier picks a status decision (see lifecycle below).
   - **Step 4 — Terbitkan SPPTG**: auto-generate certificate number, render the 4-page SPPTG PDF (react-pdf, `src/components/pdf/`), upload it to S3 as a `SPPG`-category document.
3. **Final submit**: `submissions.submitDraft` converts the draft into a permanent `submissions` row — `owner_user_id` (draft creator), `verifikator` (processor), `geom` (PostGIS polygon, SRID 4326), and the Step 3 status (default `'SPPTG terdata'`).
4. **Post-submit**: dashboard (per-status KPIs, filters, map). Status can still change via `submissions.updateStatus` (verifikator+); every change is recorded in `status_history` / `riwayat` as an audit trail.

## SPPTG status lifecycle (`status_spptg` enum)

| Status | Meaning | Rules in code |
|---|---|---|
| `SPPTG terdata` | Recorded, **no decision yet** — the initial/default status | Applied by `submitDraft` when the draft has no valid status |
| `SPPTG terdaftar` | **Approved** — passed verification, officially registered; prerequisite for Step 4 issuance | Choosing it when PostGIS found overlaps triggers a confirmation warning (`Step3Results.tsx`) |
| `SPPTG ditinjau ulang` | **Needs revision** — returned to applicant | Feedback/reason **required**; may attach `Lampiran Feedback` documents |
| `SPPTG ditolak` | **Rejected** permanently | Feedback/reason **required** |
| `Terbit SPPTG` | Certificate **issued** — intended final state | ⚠️ **Never actually set by any code path**: `submitDraft` whitelists only the other four statuses, Step 4 generates the PDF without changing status, and `StatusBadge.tsx` excludes it from its config. "Issued" is currently only observable via the certificate number + uploaded `SPPG` PDF document |

`terdata` vs `terdaftar` is the confusing pair: `terdata` = "in the system, awaiting decision"; `terdaftar` = "approved".

## Architecture

**Stack**: Next.js 16 App Router, React 19, tRPC v11, Drizzle ORM on PostgreSQL + PostGIS, Clerk auth, Tailwind 4 + shadcn/ui, S3-compatible storage, Google Maps (`@vis.gl/react-google-maps`), `@react-pdf/renderer` for certificates, Zod v4.

**Request path**: `src/proxy.ts` (Clerk middleware) → tRPC handler at `src/app/api/trpc/[trpc]/route.ts` → routers in `src/trpc/routers/` (auth, drafts, documents, submissions, prohibitedAreas, villages, users) → query functions in `src/server/db/queries/`. The single Drizzle schema is `src/server/db/schema.ts`.

**Authorization is two-layered**:
1. Procedure middleware in `src/trpc/init.ts`: `publicProcedure` → `protectedProcedure` → `verifikatorProcedure` (Superadmin/Admin/Verifikator) → `adminProcedure` (Superadmin/Admin) → `superadminProcedure`. The role field is `appUser.peran`.
2. Row-level scoping via `src/server/authz.ts` — reuse these helpers (`canAccessDraft`, `assertCanAccessSubmission`, `getSubmissionScopeForUser`, …) in routers rather than reimplementing checks. `submissions.owner_user_id` is the source of truth for Viewer visibility; `verifikator` is the processor, not the owner.

Two submission-flow gotchas that have caused real data loss:
- On step transitions, the current step's data must be **explicitly saved before** updating `currentStep` — do not rely on auto-save intervals or unmount effects (race conditions).
- The payload passed to `saveDraftStep` is manually constructed; a field missing there silently never persists, even though local state looks correct.

**Spatial analysis**: `src/server/postgis.ts` runs raw PostGIS queries (`ST_Intersects`/`ST_Intersection`/`ST_Area`) to check submission polygons against `prohibited_areas.geom` (protected zones: Hutan Lindung, Tanah Pemerintah, Sempadan Sungai, …); results are cached in `overlap_results`. Coordinate/GeoJSON/UTM helpers and KMZ/KML import live in `src/lib/` (`map-utils.ts`, `utm-conversion.ts`, `kmz-parser.ts`).

**File storage**: uploads go client → base64 → `documents.uploadFile` → S3 (`src/server/s3/s3.ts`), keyed `submissions/{category}/{timestamp}-{randomId}-{filename}`. Official form templates live at `template-documents/{filename}`, fetched via `documents.getTemplateUrl` (signed URL) or `documents.fetchTemplatePDF` (base64).

**PDF generation**: SPPTG certificates are rendered with react-pdf components in `src/components/pdf/`, with data mapping in `src/lib/spptg-pdf-data.ts` and `src/lib/pdf-generator.ts`.

## Gotchas

- Legacy mixed-case column: the submissions village column is `submissions."villageId"` — raw SQL and index definitions must quote it exactly.
- Drizzle configs exclude PostGIS system tables via `tablesFilter: ['!geography_columns', '!geometry_columns']` and `extensionsFilters: ["postgis"]` — keep these when editing the configs.
- Status enum values use the `SPPTG` prefix (`'SPPTG terdata'`, `'Terbit SPPTG'`, …); some older UI code uses a wrong `SKT` prefix (see Known Issues in AGENTS.md).
- If new authz columns are missing from a database, authenticated pages fail with HTTP 500 on `auth.me` / `drafts.getById`.
