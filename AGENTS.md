# AGENTS.md - E-SPPTG Codebase Guide

> This document helps AI agents understand the E-SPPTG codebase structure, conventions, and known issues.

## Project Overview

**E-SPPTG** (Electronic Surat Pernyataan Penguasaan Tanah Garapan) is a digital land registration system for managing land ownership claims in Indonesia. It enables government officials to:

- Process land registration submissions through a multi-step workflow
- Validate land boundaries against prohibited areas using spatial analysis
- Track submission status through various approval stages
- Manage documents and generate official land certificates (SPPTG)

### Domain Context

This is a **government land registry application** for Indonesian local government (likely Kabupaten/Regency level). The system handles:

1. **Land Claims** - Citizens submit claims for agricultural land they've been cultivating
2. **Field Validation** - Survey teams verify boundaries with witnesses
3. **Spatial Analysis** - System checks for overlaps with protected/prohibited areas
4. **Approval Workflow** - Verifiers review and approve/reject submissions
5. **Certificate Issuance** - Approved claims receive official SPPTG documents

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Frontend** | React 19, Tailwind CSS 4, Radix UI, shadcn/ui |
| **API** | tRPC v11 (type-safe RPC) |
| **Database** | PostgreSQL with PostGIS extension |
| **ORM** | Drizzle ORM |
| **Auth** | Self-hosted: scrypt password hashes + server-side sessions (no third party) |
| **Storage** | S3-compatible (AWS S3 or Cloudflare R2) |
| **Maps** | Google Maps API (@vis.gl/react-google-maps) |
| **PDF** | @react-pdf/renderer, pdf-lib |
| **Validation** | Zod v4 |
| **Forms** | React Hook Form |

---

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/trpc/          # tRPC API route handler
│   ├── app/               # Authenticated app routes
│   │   ├── layout.tsx     # App shell with sidebar/header
│   │   ├── page.tsx       # Dashboard
│   │   ├── pengajuan/     # Submission routes
│   │   └── pengaturan/    # Settings page
│   ├── layout.tsx         # Root layout (tRPC + auth providers)
│   └── page.tsx           # Landing page
│
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── maps/              # Google Maps components
│   │   ├── DrawingMap.tsx # Polygon drawing for land boundaries
│   │   └── ReadOnlyMap.tsx # Display submissions on map
│   ├── pdf/               # SPPTG PDF rendering (react-pdf)
│   ├── submission-steps/  # Multi-step form components
│   │   ├── Step1DocumentUpload.tsx
│   │   ├── Step2FieldValidation.tsx
│   │   ├── Step3Results.tsx
│   │   └── Step4Issuance.tsx
│   ├── FileUploadField.tsx # Shared upload UI + template downloads
│   └── *.tsx              # Feature components
│
├── data/                  # Mock data for UI development
├── hooks/                 # Custom hooks (auth role, PDF generation, responsive)
│
├── server/
│   ├── db/
│   │   ├── db.ts          # Drizzle client
│   │   ├── schema.ts      # Database schema
│   │   └── queries/       # Query functions by entity
│   ├── postgis.ts         # PostGIS overlap calculations
│   └── s3/s3.ts           # S3 file upload utilities
│
├── trpc/
│   ├── client.tsx         # tRPC React client
│   ├── context.ts         # Request context (auth, db)
│   ├── init.ts            # tRPC initialization, procedures
│   └── routers/           # API routers by domain
│       ├── _app.ts        # Root router
│       ├── auth/
│       ├── drafts/
│       ├── document/
│       ├── submissions/
│       ├── prohibitedAreas/
│       ├── villages/
│       └── users/
│
├── types/
│   └── index.ts           # Shared TypeScript types
│
└── lib/
    ├── utils.ts           # Utility functions
    ├── map-utils.ts       # GeoJSON/coordinate helpers
    ├── map-static-api.ts  # Google Static Maps helpers
    ├── kmz-parser.ts      # KMZ/KML parsing for geospatial imports
    ├── templates.ts       # Document template names
    ├── pdf-generator.ts   # SPPTG PDF generation
    ├── pdf-coordinates.ts # PDF coordinate mapping
    ├── certificate-number-generator.ts # SPPTG number helpers
    ├── number-to-words.ts # Terbilang helpers
    └── validation/        # Zod schemas

src/proxy.ts               # Edge middleware: session-cookie gate for /app/*
```

---

## Database Schema

### Core Entities

| Table | Purpose |
|-------|---------|
| `users` | System users (email + `password_hash`) with roles |
| `sessions` | Server-side sessions; `id` is the SHA-256 of the cookie token |
| `password_reset_tokens` | Single-use, 1-hour "lupa sandi" / invite tokens |
| `villages` | Reference data for villages (desa) |
| `submissions` | Final submitted land claims |
| `submission_drafts` | In-progress multi-step form data (JSONB payload) |
| `submissions_documents` | Uploaded documents linked to drafts/submissions |
| `prohibited_areas` | Protected zones that can't have SPPTG (PostGIS polygon) |
| `overlap_results` | Cached overlap calculations |
| `status_history` | Audit trail of status changes |

### Access Control Columns (2026-02 Update)

| Table | Column | Purpose |
|-------|--------|---------|
| `users` | `assigned_village_id` | Single-desa assignment for `Admin`/`Verifikator` scoping |
| `submission_drafts` | `village_id` | Materialized desa for secure draft filtering/routing |
| `submissions` | `owner_user_id` | Submission owner (draft creator), distinct from `verifikator` (processor) |

### Key Enums

```typescript
// User roles (hierarchical permissions)
type UserRole = 'Superadmin' | 'Admin' | 'Verifikator' | 'Viewer';

// Submission lifecycle
type StatusSPPTG = 
  | 'SPPTG terdata'        // Initial submission
  | 'SPPTG terdaftar'      // Registered/approved
  | 'SPPTG ditolak'        // Rejected
  | 'SPPTG ditinjau ulang' // Needs revision
  | 'Terbit SPPTG'         // Certificate issued

// Document categories
type DocumentCategory = 
  | 'KTP' | 'KK' | 'Kwitansi' | 'Permohonan' 
  | 'SK Kepala Desa' | 'Berita Acara' | 'Pernyataan Jual Beli'
  | 'Asal Usul' | 'Tidak Sengketa' | 'Foto Lahan'
  | 'SPPG' | 'SPPTG Induk' | 'Lampiran Feedback' | 'Lainnya'
```

### Spatial Data

The system uses **PostGIS** for spatial operations:

- `submissions.geom` - **MultiPolygon** of land boundaries (SRID 4326): one pengajuan can cover several separated bidang. Rows filed before that are single-part MultiPolygons; every predicate below behaves identically either way
- `prohibited_areas.geom` - **MultiPolygon** of a protected zone: an SK usually covers several detached blocks. A multi-polygon KML can be loaded either as the blocks of one kawasan (kawasan form) or as one kawasan row per polygon (`prohibitedAreas.createBulk`)
- `overlap_results.intersection_geom` - Calculated overlap geometry, untyped `geometry` since an intersection may be a Polygon, MultiPolygon or GeometryCollection

Key spatial queries in `src/server/postgis.ts`:
- `ST_Intersects()` - Check if polygons overlap
- `ST_Intersection()` - Get overlapping area
- `ST_Area()` - Calculate area in square meters

---

## API Routes (tRPC)

### Router Structure

```typescript
// src/trpc/routers/_app.ts
appRouter = {
  auth: authRouter,           // User authentication
  drafts: draftsRouter,       // Multi-step form drafts
  documents: documentsRouter, // File uploads
  submissions: submissionsRouter, // Land claims
  prohibitedAreas: prohibitedAreasRouter,
  villages: villagesRouter,
  users: usersRouter,
}
```

### Procedure Types

```typescript
// src/trpc/init.ts
publicProcedure     // No auth required
protectedProcedure  // Requires logged-in user
adminProcedure      // Requires Superadmin or Admin role
verifikatorProcedure // Requires Superadmin, Admin, or Verifikator
superadminProcedure // Requires Superadmin only
```

### Key Endpoints

| Router | Procedure | Description |
|--------|-----------|-------------|
| `drafts.getOrCreateCurrent` | query | Get user's current draft or create one |
| `drafts.getById` | query | Load a draft by id |
| `drafts.saveStep` | mutation | Save form progress per step |
| `drafts.listMy` | query | List accessible drafts (own for Viewer, desa-scoped for Admin/Verifikator, all for Superadmin) |
| `submissions.submitDraft` | mutation | Convert draft to final submission |
| `submissions.getById` | query | Fetch a submission by id |
| `submissions.list` | query | List submissions with filters |
| `submissions.getOverlaps` | query | Fetch overlap results for a submission |
| `submissions.checkOverlapsFromCoordinates` | mutation | Check polygon overlaps before submission |
| `documents.uploadFile` | mutation | Upload file to S3 via server |
| `documents.listByDraft` | query | List draft documents |
| `documents.listBySubmission` | query | List submission documents |
| `documents.delete` | mutation | Delete document record |
| `documents.getTemplateUrl` | mutation | Get signed URL for template PDF |
| `documents.fetchTemplatePDF` | mutation | Fetch template PDF as base64 |

---

## Authentication & Authorization

### Self-hosted authentication

No identity provider is involved. Everything lives in `src/server/auth/`:

| Module | Responsibility |
|---|---|
| `password.ts` | scrypt hashing (N=16384, r=8, p=1), constant-time verify, `fakeVerifyPassword` to equalise timing on unknown emails |
| `session.ts` | Create/validate/revoke sessions; 30-day expiry with sliding renewal past the halfway mark |
| `cookies.ts` | Builds and parses the `espptg_session` cookie (HttpOnly, SameSite=Lax, Secure in production) |
| `password-reset.ts` | Single-use, 1-hour reset/invite tokens |
| `mailer.ts` | Gmail SMTP (nodemailer) — the only remaining third-party call, used solely for reset and invite email |
| `rate-limit.ts` | In-process throttle on login / register / reset-request |

**Only token digests are stored.** `sessions.id` and `password_reset_tokens.id`
are SHA-256 of the value the user holds, so a database dump cannot be replayed.

**Sign-in is two steps**: `auth.checkEmail` first, then `auth.login`. The first
step decides whether to ask for a password at all — an admin-created account
that has not accepted its invite has `password_hash = NULL`, so the form sends
that person to `/lupa-sandi?alasan=belum-ada-sandi` instead of asking for a
password that does not exist.

> ⚠️ `checkEmail` is by construction a narrow account-enumeration oracle: a
> `'reset'` answer confirms the address is a real, password-less account. Every
> other case — unknown email, deactivated account, account with a password —
> answers `'password'`, so those stay indistinguishable, and the failure surfaces
> later through `login`'s single generic message. It is rate-limited on email+IP
> exactly like `login`. Keep it that way: widening the answers (e.g. returning
> "email tidak terdaftar") turns the form into a full membership check on staff
> addresses.

**Registration** (`auth.register`) always lands on `Viewer`; the role is never
read from input. An admin promotes the account afterwards.

**Admin-created accounts** (`users.create`) are *always* created with
`password_hash = NULL` **and** `email_verified_at = NULL`, then emailed an invite
link — an admin cannot set an initial password, and the procedure refuses to
create anyone at all when the mailer is unconfigured (there would be no way into
the account). Redeeming that link in `auth.resetPassword` both sets the first
password and stamps `email_verified_at`, which is what keeps the account from
being rejected at login as unverified. `hasPassword` is what the UI shows; the
hash never leaves the server (`toClientUser` strips it from every read).

**Deactivation** (`users.toggleStatus`, or `status: 'Nonaktif'` via
`users.update`) deletes the account's session rows, and `src/trpc/init.ts`
re-checks `status` on every request for anything already in flight.

**Where the boundary is**: `src/proxy.ts` runs on the Edge and can only see
whether a session cookie *exists* — it cannot reach the database. Real
authorization is the tRPC procedure middleware. `/api/trpc` is deliberately
ungated so anonymous callers can reach login, registration and password reset.
`src/app/app/layout.tsx` signs the user out when `auth.me` comes back 401,
which is what handles a cookie that got past the middleware but is revoked.

### Role Hierarchy

```
Superadmin > Admin > Verifikator > Viewer
```

| Role | Permissions |
|------|-------------|
| Superadmin | Full access to all features |
| Admin | Desa-scoped access to drafts/submissions; requires `assigned_village_id` |
| Verifikator | Desa-scoped access to drafts/submissions; requires `assigned_village_id` |
| Viewer | Own drafts only; cannot progress past Step 1 |

### Role + Desa Gating Rules (Implemented)

| Role | Draft Access | Step Progression | Submission Access |
|------|--------------|------------------|-------------------|
| Superadmin | All drafts | Step 1–4 | All submissions |
| Admin | Own + assigned desa drafts | Step 1–4 | Assigned desa submissions |
| Verifikator | Own + assigned desa drafts | Step 1–4 | Assigned desa submissions |
| Viewer | Own drafts only | Step 1 only | Own submissions (`owner_user_id`) |

---

## Multi-Step Submission Flow

The submission process has 4 steps:

1. **Berkas (Documents)** - Select desa, fill applicant data, upload mandatory KTP + KK
2. **Lapangan (Field Validation)** - Enter coordinates, witnesses, survey team
3. **Hasil (Results)** - Set status decision (approve/reject/revise)
4. **Terbitkan SPPTG (Issuance)** - Generate final certificate (only if approved)

Draft data is stored as JSONB in `submission_drafts.payload` and validated per-step using Zod schemas in `src/lib/validation/submission-draft.ts`.

### Submission Architecture & Gotchas

*   **State Persistence**: Data is primarily saved to `submission_drafts` via `trpc.drafts.saveStep`. The final submission is created from this draft via `trpc.submissions.submitDraft`.
*   **Explicit Saving**: When transitioning between steps (e.g., using `handleNext` in `SubmissionFlow.tsx`), the **current** step's data MUST be explicitly saved to the backend *before* changing the local `currentStep` state. Relying solely on auto-save intervals or `useEffect` hooks triggered by unmounts can lead to data loss (race conditions).
*   **Payload Construction**: The payload object passed to `saveDraftStep` (in `saveDraftToBackend`) must be manually constructed to include ALL relevant fields from the state. Missing fields here (like `luasManual` previously) will cause data to not be persisted to the DB, even if the local state is correct.
*   **Data Flow**:
    1.  User enters data (Step 2: Coordinates, `luasManual`, Witnesses).
    2.  `handleNext` triggered.
    3.  `saveDraftMutation` called with current step data (including `luasManual`).
    4.  On success, `currentStep` state updates to next step.
    5.  Final submission reads from `submission_drafts.payload`.

### Authorization Implementation Notes (2026-02)

* Centralized authorization helpers are in `src/server/authz.ts` and should be reused across routers.
* `submissions.owner_user_id` is now the source of truth for Viewer visibility (not `verifikator`).
* `verifikator` remains the processor/auditor user who handled the submission.
* `documentsRouter` access now follows shared draft/submission authz predicates.

---

## File Storage

Documents are uploaded to S3-compatible storage:

1. Client calls `documents.createUploadUrl` to get S3 key
2. Client converts file to base64
3. Client calls `documents.uploadFile` with base64 data
4. Server uploads to S3 and updates document record

Files are organized: `submissions/{category}/{timestamp}-{randomId}-{filename}`

Template documents are stored at: `template-documents/{filename}` and retrieved via
`documents.getTemplateUrl` (signed URL) or `documents.fetchTemplatePDF` (server-side base64).

---

## Indonesian Terminology Glossary

| Term | Translation | Context |
|------|-------------|---------|
| SPPTG | Surat Pernyataan Penguasaan Tanah Garapan | Land ownership statement |
| Pengajuan | Submission | A land claim application |
| Berkas | Documents/Files | Step 1 of submission |
| Lapangan | Field | Field validation step |
| Desa | Village | Administrative unit |
| Kecamatan | District | Administrative unit (contains villages) |
| Kabupaten | Regency | Administrative unit (contains districts) |
| NIK | Nomor Induk Kependudukan | National ID number (16 digits) |
| KTP | Kartu Tanda Penduduk | ID card |
| KK | Kartu Keluarga | Family card |
| Juru Ukur | Surveyor | Field team member |
| BPD | Badan Permusyawaratan Desa | Village council |
| Saksi | Witness | Boundary witness |
| Kawasan | Area/Zone | Protected area type |
| Verifikator | Verifier | Official who reviews submissions |

---

## Known Issues & Technical Debt

### Critical Bugs

| Priority | Issue | Location | Description |
|----------|-------|----------|-------------|
| 🔴 High | Status history bug | `src/server/db/queries/submissions.ts:110-115` | `statusBefore` is set to the NEW status instead of the original status before the change |
| 🔴 High | Status enum mismatch | `src/components/DetailPage.tsx:125-134` | Dropdown uses "SKT" prefix instead of "SPPTG" - values won't match the database enum |

### Incomplete Features

| Feature | Location | Issue |
|---------|----------|-------|
| Comments | `DetailPage.tsx:299` | "Kirim Komentar" button has no backend implementation |
| Documents tab | `DetailPage.tsx:246-265` | Hardcoded PDF link, doesn't fetch actual submission documents |
| S3 deletion | `src/components/FileUploadField.tsx:117-122` | `handleRemove` only clears local state, doesn't call `documents.delete` or remove from S3 |
| User management | `UsersTab.tsx` | Only updates local state, no backend mutations |
| Delete prohibited area | `ProhibitedAreasTab.tsx:230-237` | UI deletes locally; `prohibitedAreas.delete` exists in tRPC but isn't called |

### Code Quality Issues

| Issue | Location | Suggestion |
|-------|----------|------------|
| Multiple `as any` casts | `SubmissionFlow.tsx:88, 227` | Create proper typed payload interfaces |
| Unused state | `DrawingMap.tsx:410` | `setLoadError` is never called |
| Linting warnings | `src/components/ui/select.tsx` | Tailwind class syntax for CSS variable values (cosmetic) |

### State Management Issues

| Issue | Description |
|-------|-------------|
| Local vs backend | `handleStatusChange` in `layout.tsx` updates local state but doesn't call backend API |
| Village ID display | `DetailPage.tsx:99-101, 217` shows `villageId` number instead of village name |

### Performance/Security Concerns

| Concern | Description | Recommendation |
|---------|-------------|----------------|
| Large base64 uploads | 10MB files as base64 via tRPC can cause memory issues | Consider multipart uploads or presigned URLs |
| No file content validation | Only MIME type checked, not actual file contents | Add magic number validation |
| No rate limiting | API calls and uploads have no rate limits | Add rate limiting middleware |
| No pagination | Dashboard fetches up to 100 submissions | Implement proper pagination |

---

## Development Commands

```bash
# Development
pnpm dev

# Database
pnpm push:stag          # Push schema to staging
pnpm push:prod          # Push schema to production
pnpm pull:stag          # Pull schema from staging
pnpm pull:prod          # Pull schema from production
pnpm generate:stag      # Generate migrations for staging
pnpm generate:prod      # Generate migrations for production
pnpm generate-schema    # Generate from schema config (staging)
pnpm migrate:stag       # Run migrations on staging
pnpm migrate:prod       # Run migrations on production

# Linting
pnpm lint
```

### Migration / DB Gotchas

* Prefer `pnpm migrate:stag` / `pnpm migrate:prod` for production-like updates.
* `pnpm push:stag` can fail on existing environments with PostGIS typmod conflicts (e.g. `Geometry type (Polygon) does not match column type (Point)`).
* If new authz columns are missing, authenticated pages can fail with HTTP 500 on `auth.me` / `drafts.getById`.
* Legacy schema naming is mixed-case for submission village column (`submissions."villageId"`). Raw SQL and indexes must quote `"villageId"` exactly.

## Environment Variables

Required environment variables:

```env
DATABASE_URL=           # PostgreSQL connection string (with PostGIS)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# SMTP — used ONLY for verification, "lupa sandi" and account-invite email.
# Production is the Pemkab mail server (mail.kutaitimurkab.go.id).
# If SMTP_USER/SMTP_PASSWORD are unset the app still runs; only those emails
# fail, with a clear message. Legacy GMAIL_USER/GMAIL_APP_PASSWORD still work
# as a fallback when SMTP_* are empty.
SMTP_HOST=              # Omit to fall back to Gmail's service preset
SMTP_PORT=              # 465 = implicit TLS, 587 = STARTTLS (default 587)
SMTP_SECURE=            # Optional override; defaults to true only on port 465
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM_ADDRESS=      # Optional envelope From (default: SMTP_USER)
MAIL_FROM_NAME=         # Display name on outgoing mail (default: SIAPTAH)
NEXT_PUBLIC_APP_URL=    # Absolute base URL for email links AND the SEO canonical
                        # host (src/lib/site.ts); unset falls back to the
                        # production domain, never localhost
GOOGLE_SITE_VERIFICATION=  # Optional. Search Console "HTML tag" value. Read at
                        # BUILD time — "/" is prerendered, so it must be a build
                        # arg (see Dockerfile), not just a runtime env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
S3_ENDPOINT=            # For R2 or custom S3
S3_PUBLIC_URL=          # Public URL prefix for files

# Web Push (browser + installed PWA notifications). Optional: with these unset
# the in-app bell still works and no device notifications are sent.
# Generate the pair once with `npx web-push generate-vapid-keys`.
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=          # Contact for the push services, e.g. mailto:admin@…

# Self-registration throttle. Optional — unset means 10 attempts per 5 minutes.
# Keyed on IP alone (a new account has no email to key on yet), so everyone
# behind one NAT shares one budget. Raise it only for a known event such as a
# training session where dozens of people register from the same WiFi, and put
# it back afterwards: a permanently high value re-opens bulk account creation.
REGISTER_RATE_LIMIT=            # Attempts per window (default 10)
REGISTER_RATE_LIMIT_WINDOW_MINUTES=  # Window length (default 5)

# SSO Kutai Timur (Keycloak realm `kutimkab`). Optional and OFF by default.
# Additive by design: with it on, email + password still works for every account
# including @gmail.com ones — SSO only adds a second door for staff addresses.
# With it off (or incompletely configured) every SSO route answers 404.
SSO_ENABLED=false       # true/1/yes/on turns it on; anything else is off
SSO_ISSUER=             # https://sso.kutaitimurkab.go.id/auth/realms/kutimkab
SSO_CLIENT_ID=
SSO_CLIENT_SECRET=      # Empty = public client (PKCE only); set = confidential
SSO_REDIRECT_URI=       # Must match "Valid Redirect URIs" character for character
SSO_ALLOWED_EMAIL_DOMAINS=  # Comma-separated; default kutaitimurkab.go.id, empty = any
SSO_PROMPT=             # 'login' forces the SSO login screen every time
SSO_STATE_SECRET=       # Only for a public client: signs the handshake cookies

# Postgres connections held by one app container. Optional — default 20, which
# is what "50 people working at once" needs. node-postgres' own default is 10,
# and a saturated pool queues requests rather than failing them, so too low
# looks like the app hanging. Never exceed the server's max_connections minus
# headroom for psql, backups and the migrator.
DATABASE_POOL_MAX=
```
