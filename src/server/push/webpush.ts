import 'server-only';
import webpush, { type PushSubscription, WebPushError } from 'web-push';
import * as pushQueries from '@/server/db/queries/push-subscriptions';

/**
 * Web Push delivery for the browser and the installed PWA.
 *
 * Follows the same rule as `withRedis()`: push is an enhancement, never a
 * dependency. With no VAPID keys configured every function here degrades to a
 * no-op, so local development and any deployment that has not generated keys
 * keeps working — the in-app bell (`notifications.list`) is the baseline and is
 * unaffected.
 *
 * Generate a key pair once with:
 *   npx web-push generate-vapid-keys
 * then set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY?.trim();
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY?.trim();
// Push services require a contact for the sender; mailto: is what they expect.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@siaptah.id';

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

/** The public key the browser needs for `pushManager.subscribe`. */
export function getVapidPublicKey(): string | null {
  return isPushConfigured() ? VAPID_PUBLIC_KEY! : null;
}

function ensureConfigured(): boolean {
  if (!isPushConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** In-app path to open when the notification is clicked. */
  url?: string;
  /** Collapses repeated notifications about the same pengajuan. */
  tag?: string;
};

export type PushResult = { sent: number; removed: number };

/**
 * Fan a payload out to every device belonging to `userIds`.
 *
 * Never throws: a push service being down or a single dead endpoint must not
 * roll back the submission the notification is about. Endpoints the service
 * reports as gone (404/410) are deleted so the table does not accumulate
 * uninstalled browsers.
 */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload
): Promise<PushResult> {
  if (userIds.length === 0) return { sent: 0, removed: 0 };
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  let subscriptions;
  try {
    subscriptions = await pushQueries.listPushSubscriptionsForUsers(userIds);
  } catch (error) {
    console.error('Gagal membaca langganan notifikasi:', error);
    return { sent: 0, removed: 0 };
  }
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  const staleEndpoints: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        // 24h: long enough for a phone that is off overnight, short enough that
        // a stale pengajuan alert is not delivered days later.
        await webpush.sendNotification(subscription, body, { TTL: 86_400 });
        sent += 1;
      } catch (error) {
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          staleEndpoints.push(row.endpoint);
          return;
        }
        console.error('Gagal mengirim notifikasi push:', error);
      }
    })
  );

  if (staleEndpoints.length > 0) {
    try {
      await pushQueries.deletePushSubscriptionsByEndpoints(staleEndpoints);
    } catch (error) {
      console.error('Gagal menghapus langganan notifikasi kedaluwarsa:', error);
    }
  }

  return { sent, removed: staleEndpoints.length };
}
