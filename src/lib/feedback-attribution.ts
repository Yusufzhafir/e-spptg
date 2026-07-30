/**
 * Who a Step 3 decision is attributed to.
 *
 * `feedback.pemberi` and `verifikator` are part of the audit trail for a rejected
 * or returned pengajuan, so they must not be whatever the browser happened to
 * send — a direct API call could name anyone. The server overwrites both from the
 * authenticated session, the same way `submitDraft` already does for the
 * `submissions.verifikator` column.
 *
 * Only fields the client actually tried to set are rewritten: a Step 1 or Step 2
 * save never gains a `feedback` or `verifikator` key it did not have.
 */

export type DecisionActor = {
  id: number;
  nama: string;
};

// Generic so the caller keeps whatever payload type it had — the shape is
// unchanged, only two leaf values are rewritten.
export function stampFeedbackAttribution<T>(payload: T, actor: DecisionActor): T {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const record = payload as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  let changed = false;

  const feedback = record.feedback;
  if (feedback && typeof feedback === 'object' && !Array.isArray(feedback)) {
    next.feedback = { ...(feedback as Record<string, unknown>), pemberi: actor.nama };
    changed = true;
  }

  // `in` rather than a truthiness check: the client may legitimately send
  // verifikator: null, and that still means "attribute this decision to me".
  if ('verifikator' in record) {
    next.verifikator = actor.id;
    changed = true;
  }

  return (changed ? next : payload) as T;
}
