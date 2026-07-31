/**
 * Strips secrets out of anything on its way into an audit log.
 *
 * The audit trail is read by Superadmins and kept indefinitely, so it is the
 * last place a password, a session token or a reset link should end up. This
 * runs on every `sebelum`/`sesudah` snapshot and on every procedure input
 * before it is written.
 *
 * Pure (no server-only import) so it can be unit tested directly.
 */

/**
 * Matched case-insensitively against the *whole* key name. Deliberately blunt:
 * a new field called `passwordBaru` or `apiKey` is redacted without anyone
 * having to remember to add it, and over-redacting an audit log costs nothing
 * while under-redacting leaks a credential.
 */
const SENSITIVE_KEY = /(password|sandi|token|secret|rahasia|apikey|api_key|authorization|cookie|hash)/i;

export const REDACTED = '[disensor]';

/** Values longer than this are truncated — a base64 KML payload or a document
 *  blob would otherwise make one audit row megabytes wide. */
const MAX_STRING = 500;
const MAX_ARRAY = 50;

export function redact(value: unknown, depth = 0): unknown {
  // Guard against cycles and pathological nesting; 8 levels is far deeper than
  // any payload this app produces.
  if (depth > 8) return '[terlalu dalam]';

  if (value === null || value === undefined) return value ?? null;

  if (typeof value === 'string') {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}… (${value.length} karakter)`
      : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const trimmed = value.slice(0, MAX_ARRAY).map((v) => redact(v, depth + 1));
    return value.length > MAX_ARRAY
      ? [...trimmed, `… ${value.length - MAX_ARRAY} item lainnya`]
      : trimmed;
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }

  // Functions, symbols, bigint — nothing an audit reader needs.
  return String(value);
}

/**
 * The fields that actually changed, as `{ field: { sebelum, sesudah } }`.
 *
 * Used by the UI to show a short "what changed" list instead of two full JSON
 * blobs. Fields present in only one side are included, so an added or removed
 * column still shows up.
 */
export function diffFields(
  before: unknown,
  after: unknown
): Record<string, { sebelum: unknown; sesudah: unknown }> {
  if (
    !before ||
    !after ||
    typeof before !== 'object' ||
    typeof after !== 'object' ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return {};
  }

  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  const changed: Record<string, { sebelum: unknown; sesudah: unknown }> = {};

  for (const field of new Set([...Object.keys(a), ...Object.keys(b)])) {
    // JSON comparison rather than `!==` so nested objects and dates that
    // serialise identically are not reported as changes.
    if (JSON.stringify(a[field]) !== JSON.stringify(b[field])) {
      changed[field] = { sebelum: a[field] ?? null, sesudah: b[field] ?? null };
    }
  }

  return changed;
}
