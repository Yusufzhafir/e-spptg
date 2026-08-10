# Browser end-to-end suite

Playwright driving the real app in Chrome: real login form, real wizard, real
uploads, real database. Complements the Vitest suites, which exercise tRPC
procedures directly and never touch a page.

```bash
pnpm test:e2e            # headless
pnpm test:e2e:headed     # watch it click
pnpm test:e2e:ui         # Playwright's interactive runner
pnpm test:e2e -g saksi   # one group
```

## What it needs

- `.env.development.local` pointing at a **non-production** database. The suite
  creates and deletes rows on every run.
- Google Chrome installed (`channel: 'chrome'` — no Playwright browser download).
- Nothing else: `pnpm test:e2e` starts its own dev server on port 3111, so it
  will not collide with a `pnpm dev` you already have open.

## What a run does to the database

`global-setup.ts` seeds three desa and seven accounts (one per role, plus a
second Admin, Kecamatan and Viewer so cross-scope refusals can be tested), all
named `E2E-<tag>`. Accounts are inserted with a scrypt digest directly rather
than through `users.create`, which would mail a real invite link.

Each account is then signed in **through the login form** and its session cookie
is stored in `e2e/.auth/`, so every run exercises sign-in before any spec starts.

`global-teardown.ts` deletes everything tagged `E2E-<tag>` — including objects
uploaded to S3 during the run — in FK-safe order. It runs even when specs fail.

Set `E2E_TAG` to run two suites against one database without them colliding.

## Deliberately switched off during a run

The dev server is started with `SMTP_*`/`GMAIL_*` and `VAPID_*` blank. Both are supported
"not configured" states in this codebase, and it keeps a test run from mailing
anyone or pushing notifications to real subscribed browsers.

## Layout

| Path | Purpose |
|---|---|
| `fixtures/accounts.ts` | Roles, desa and the per-run tag |
| `fixtures/db.ts` | Direct database access + the scrypt digest format |
| `fixtures/wizard.ts` | Draft creation, Step 1 completion, uploads |
| `specs/navigation.spec.ts` | Menu visibility and page gating per role |
| `specs/saksi-form.spec.ts` | Saksi Batas Lahan: add, search, edit, cancel |
| `specs/wizard.spec.ts` | Step gating and data persistence across steps |

`specs/saksi-form.spec.ts` also writes `e2e/.artifacts/saksi-form.png` so the
form can be eyeballed after a run.
