import 'server-only';
import * as pushQueries from '@/server/db/queries/push-subscriptions';
import { sendPushToUsers, isPushConfigured } from './webpush';
import type { StatusSPPTG } from '@/types';

/**
 * Turns a submission event into device notifications.
 *
 * Kept apart from `createNotification`, which writes the row that feeds the
 * in-app bell: that write belongs inside the submit transaction, while the push
 * must only go out once the transaction has committed — otherwise a rollback
 * leaves people holding a notification for a pengajuan that does not exist.
 * Call this *after* the transaction returns.
 */

export type SubmissionPushEvent = {
  submissionId: number;
  kind: 'created' | 'updated' | 'status';
  status: StatusSPPTG;
  namaPemilik: string;
  villageId: number;
  ownerUserId: number | null;
  /** Whoever triggered it — excluded from the recipients. */
  actorUserId: number | null;
};

function buildMessage(event: SubmissionPushEvent): { title: string; body: string } {
  switch (event.kind) {
    case 'created':
      return {
        title: 'Pengajuan SPPTG baru',
        body: `${event.namaPemilik} — ${event.status}`,
      };
    case 'status':
      return {
        title: 'Status SPPTG diperbarui',
        body: `${event.namaPemilik} — ${event.status}`,
      };
    case 'updated':
    default:
      return {
        title: 'Pengajuan SPPTG diperbarui',
        body: `${event.namaPemilik} — ${event.status}`,
      };
  }
}

/**
 * Never throws and never blocks the caller's result: a push service outage must
 * not turn a saved pengajuan into an error the user sees.
 */
export async function pushSubmissionEvent(event: SubmissionPushEvent): Promise<void> {
  if (!isPushConfigured()) return;

  try {
    const recipients = await pushQueries.listNotificationRecipientUserIds({
      villageId: event.villageId,
      ownerUserId: event.ownerUserId,
      excludeUserId: event.actorUserId,
    });
    if (recipients.length === 0) return;

    const { title, body } = buildMessage(event);
    await sendPushToUsers(recipients, {
      title,
      body,
      url: `/app/pengajuan/${event.submissionId}`,
      // One live notification per pengajuan; a later event replaces the earlier.
      tag: `spptg-${event.submissionId}`,
    });
  } catch (error) {
    console.error('Gagal mengirim notifikasi pengajuan:', error);
  }
}
