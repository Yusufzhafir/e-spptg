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
| **Auth** | Clerk (with role-based access) |
| **Storage** | S3-compatible (AWS S3 or Cloudflare R2) |
| **Maps** | Google Maps API (@vis.gl/react-google-maps) |
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
│   ├── layout.tsx         # Root layout (Clerk + tRPC providers)
│   └── page.tsx           # Landing page
│
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── maps/              # Google Maps components
│   │   ├── DrawingMap.tsx # Polygon drawing for land boundaries
│   │   └── ReadOnlyMap.tsx # Display submissions on map
│   ├── submission-steps/  # Multi-step form components
│   │   ├── Step1DocumentUpload.tsx
│   │   ├── Step2FieldValidation.tsx
│   │   ├── Step3Results.tsx
│   │   └── Step4Issuance.tsx
│   └── *.tsx              # Feature components
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
    └── validation/        # Zod schemas
```

---

## Database Schema

### Core Entities

| Table | Purpose |
|-------|---------|
| `users` | System users (Clerk-synced) with roles |
| `villages` | Reference data for villages (desa) |
| `submissions` | Final submitted land claims |
| `submission_drafts` | In-progress multi-step form data (JSONB payload) |
| `submissions_documents` | Uploaded documents linked to drafts/submissions |
| `prohibited_areas` | Protected zones that can't have SPPTG (PostGIS polygon) |
| `overlap_results` | Cached overlap calculations |
| `status_history` | Audit trail of status changes |

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

// Document categories
type DocumentCategory = 
  | 'KTP' | 'KK' | 'Kwitansi' | 'Permohonan' 
  | 'SK Kepala Desa' | 'Berita Acara' | 'SPPG' | ...
```

### Spatial Data

The system uses **PostGIS** for spatial operations:

- `submissions.geom` - Polygon of land boundaries (SRID 4326)
- `prohibited_areas.geom` - Protected zone polygons
- `overlap_results.intersection_geom` - Calculated overlap geometry

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
```

### Key Endpoints

| Router | Procedure | Description |
|--------|-----------|-------------|
| `drafts.getOrCreateCurrent` | query | Get user's current draft or create one |
| `drafts.saveStep` | mutation | Save form progress per step |
| `submissions.submitDraft` | mutation | Convert draft to final submission |
| `submissions.list` | query | List submissions with filters |
| `submissions.checkOverlapsFromCoordinates` | mutation | Check polygon overlaps before submission |
| `documents.uploadFile` | mutation | Upload file to S3 via server |

---

## Authentication & Authorization

### Clerk Integration

- Users authenticate via Clerk
- On first login, user is auto-provisioned in `users` table with "Viewer" role
- Clerk user ID is stored as `clerkUserId` for linking

### Role Hierarchy

```
Superadmin > Admin > Verifikator > Viewer
```

| Role | Permissions |
|------|-------------|
| Superadmin | Full access to all features |
| Admin | Manage users, villages, prohibited areas |
| Verifikator | Review and approve/reject submissions |
| Viewer | View-only access |

---

## Multi-Step Submission Flow

The submission process has 4 steps:

1. **Berkas (Documents)** - Upload KTP, KK, and supporting documents
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

---

## File Storage

Documents are uploaded to S3-compatible storage:

1. Client calls `documents.createUploadUrl` to get S3 key
2. Client converts file to base64
3. Client calls `documents.uploadFile` with base64 data
4. Server uploads to S3 and updates document record

Files are organized: `submissions/{category}/{timestamp}-{randomId}-{filename}`

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
| 🔴 High | Status history bug | `src/server/db/queries/submissions.ts:110-119` | `statusBefore` is set to the NEW status instead of the original status before the change |
| 🔴 High | Wrong redirect route | `src/components/SubmissionFlow.tsx:59` | Pushes to `/pengajuan/${id}` but should be `/app/pengajuan/${id}` |
| 🔴 High | Status enum mismatch | `src/components/DetailPage.tsx:125-128` | Dropdown uses "SKT" prefix instead of "SPPTG" - values won't match the database enum |

### Incomplete Features

| Feature | Location | Issue |
|---------|----------|-------|
| Comments | `DetailPage.tsx:286-291` | "Kirim Komentar" button has no backend implementation |
| Documents tab | `DetailPage.tsx:246-265` | Hardcoded PDF link, doesn't fetch actual submission documents |
| S3 deletion | `Step1DocumentUpload.tsx:119-123` | `handleRemove` only clears local state, doesn't delete from S3 |
| User management | `UsersTab.tsx` | Only updates local state, no backend mutations |
| Delete prohibited area | N/A | No delete functionality implemented |

### Code Quality Issues

| Issue | Location | Suggestion |
|-------|----------|------------|
| Multiple `as any` casts | `SubmissionFlow.tsx:187, 263, 477` | Create proper typed payload interfaces |
| Unused state | `DrawingMap.tsx:395` | `setLoadError` is never called |
| Duplicate component | `Step1DocumentUpload.tsx`, `Step2FieldValidation.tsx` | Extract shared `DocumentUploadField` component |
| Linting warnings | `LandingPage.tsx`, `select.tsx` | Minor Tailwind CSS class syntax (cosmetic) |

### React Hook Dependency Issues

| Location | Issue |
|----------|-------|
| `SubmissionFlow.tsx:146` | `useEffect` missing `saveDraftToBackend` in deps |
| `Step2FieldValidation.tsx:273-280` | `useEffect` missing `calculateArea`, `onUpdateDraft` in deps |

### State Management Issues

| Issue | Description |
|-------|-------------|
| Local vs backend | `handleStatusChange` in `layout.tsx` updates local state but doesn't call backend API |
| Draft duplication | Draft state managed in both `SubmissionFlow` and individual step components |
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
pnpm generate:stag      # Generate migrations for staging
pnpm migrate:stag       # Run migrations on staging

# Linting
pnpm lint
```

## Environment Variables

Required environment variables:

```env
DATABASE_URL=           # PostgreSQL connection string (with PostGIS)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=
S3_ENDPOINT=            # For R2 or custom S3
S3_PUBLIC_URL=          # Public URL prefix for files
```
