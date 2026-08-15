/**
 * Drafts of the Tambah/Edit Kawasan form, kept in the browser's localStorage.
 *
 * A draft asserts nothing about the land — it is one officer's unfinished
 * tracing — so it never reaches the database and never enters the audit trail.
 * The trade-off is stated plainly in the UI: a draft lives in **this browser on
 * this machine**, and clearing site data or moving to another workstation loses
 * it.
 *
 * Two things this module is careful about, both because localStorage is shared
 * ground:
 *
 * 1. **Keyed per user.** A kabupaten office runs shared workstations; without
 *    the user id in the key, the next person to sign in would be offered
 *    somebody else's half-traced Kawasan Hutan as their own draft.
 * 2. **A quota failure is reported, never swallowed.** A kawasan traced from an
 *    SK runs to thousands of vertices and localStorage is a few megabytes, so
 *    the write genuinely can fail — and a "Simpan Draft" that silently did
 *    nothing is the one outcome worse than an error.
 *
 * Every function takes the `Storage` to use so the logic is testable without a
 * DOM; it defaults to `window.localStorage` and degrades to a no-op when there
 * is none (SSR, or a browser with storage disabled).
 */

import type { KawasanDraftPayload } from '@/lib/validation';

/** One saved draft, as it sits in localStorage. */
export interface KawasanDraftRecord {
  /** Local to this browser — a string, unlike a database id. */
  id: string;
  /** Set when the draft edits an existing kawasan rather than adding one. */
  editingAreaId: number | null;
  payload: KawasanDraftPayload;
  /** ISO timestamp of the last save. */
  lastSaved: string;
}

/**
 * How many drafts one user may keep. The oldest is dropped past this, which
 * matters more here than it would in Postgres: every draft competes for the
 * same few megabytes, and one abandoned kawasan of 5 000 vertices should not be
 * what stops today's from saving.
 */
export const MAX_KAWASAN_DRAFTS = 10;

const KEY_PREFIX = 'espptg:kawasan-drafts:';

export function kawasanDraftStorageKey(userId: number): string {
  return `${KEY_PREFIX}${userId}`;
}

/** The browser's localStorage, or null where there is none (SSR, storage off). */
export function defaultKawasanDraftStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    // Safari in private mode, and any browser with storage blocked, throws on
    // access rather than returning null.
    return null;
  }
}

function readAll(userId: number, storage: Storage | null): KawasanDraftRecord[] {
  if (!storage) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(kawasanDraftStorageKey(userId));
  } catch {
    return [];
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted entry — hand back nothing rather than throwing into a render.
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(
    (row): row is KawasanDraftRecord =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as KawasanDraftRecord).id === 'string' &&
      typeof (row as KawasanDraftRecord).payload === 'object' &&
      (row as KawasanDraftRecord).payload !== null
  );
}

function writeAll(
  userId: number,
  rows: KawasanDraftRecord[],
  storage: Storage | null
): void {
  if (!storage) throw new Error('Penyimpanan lokal tidak tersedia di browser ini.');
  storage.setItem(kawasanDraftStorageKey(userId), JSON.stringify(rows));
}

/** This user's drafts, newest first. */
export function listKawasanDrafts(
  userId: number,
  storage: Storage | null = defaultKawasanDraftStorage()
): KawasanDraftRecord[] {
  return readAll(userId, storage).sort((a, b) =>
    String(b.lastSaved).localeCompare(String(a.lastSaved))
  );
}

export function getKawasanDraft(
  userId: number,
  id: string,
  storage: Storage | null = defaultKawasanDraftStorage()
): KawasanDraftRecord | null {
  return readAll(userId, storage).find((row) => row.id === id) ?? null;
}

/**
 * Create or overwrite a draft, returning the stored record.
 *
 * Passing an `id` that no longer exists writes it back rather than failing:
 * the form holds that id across a whole editing session, and refusing to save
 * because the draft was deleted in another tab would lose the work on screen —
 * which is the exact thing this feature exists to prevent.
 *
 * Throws when localStorage refuses the write (quota, storage disabled). The
 * caller is expected to surface that, not ignore it.
 */
export function saveKawasanDraft(
  userId: number,
  input: {
    id?: string;
    editingAreaId?: number | null;
    payload: KawasanDraftPayload;
  },
  storage: Storage | null = defaultKawasanDraftStorage(),
  now: Date = new Date()
): KawasanDraftRecord {
  const record: KawasanDraftRecord = {
    id: input.id ?? createKawasanDraftId(),
    editingAreaId: input.editingAreaId ?? null,
    payload: input.payload,
    lastSaved: now.toISOString(),
  };

  const others = readAll(userId, storage).filter((row) => row.id !== record.id);
  // Newest first, then trimmed — so the cap drops the stalest draft, never the
  // one being saved.
  const next = [record, ...others]
    .sort((a, b) => String(b.lastSaved).localeCompare(String(a.lastSaved)))
    .slice(0, MAX_KAWASAN_DRAFTS);

  writeAll(userId, next, storage);
  return record;
}

export function deleteKawasanDraft(
  userId: number,
  id: string,
  storage: Storage | null = defaultKawasanDraftStorage()
): void {
  const remaining = readAll(userId, storage).filter((row) => row.id !== id);
  writeAll(userId, remaining, storage);
}

/** Id for a new draft. `crypto.randomUUID` where available, timestamp otherwise. */
export function createKawasanDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `kd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A quota failure phrased for the officer who just pressed "Simpan Draft". */
export function kawasanDraftSaveErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return 'Penyimpanan draft di browser penuh. Hapus draft lama lalu coba lagi.';
  }
  return error instanceof Error
    ? error.message
    : 'Gagal menyimpan draft kawasan di browser ini.';
}
