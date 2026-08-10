/**
 * Read a positive whole number from an environment variable, falling back to a
 * default for anything unusable.
 *
 * Both callers are operational dials that get set under pressure — the
 * self-registration throttle before a training day, the database pool size when
 * a room fills up — so a typo must land on the documented default rather than on
 * `NaN`, `0`, or a negative number, each of which fails in its own confusing way
 * (no throttle at all, a pool that can never hand out a connection).
 */
export function positiveIntFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
