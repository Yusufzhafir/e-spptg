import { z } from 'zod';
import { protectedProcedure, router } from '../../init';
import * as notificationQueries from '@/server/db/queries/notifications';
import * as pushQueries from '@/server/db/queries/push-subscriptions';
import { getVapidPublicKey, isPushConfigured } from '@/server/push/webpush';

/**
 * A browser PushSubscription serialised by `subscription.toJSON()`. The keys
 * are base64url strings produced by the browser, not anything we choose.
 */
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.appUser!;
    const rows = await notificationQueries.listNotificationsScoped({
      role: user.peran,
      userId: user.id,
      assignedVillageId: user.assignedVillageId,
      assignedKecamatan: user.assignedKecamatan,
    });
    return rows.map((n) => ({
      id: n.id,
      submissionId: n.submissionId,
      type: n.type as 'created' | 'updated',
      status: n.status,
      namaPemilik: n.namaPemilik,
      createdAt: n.createdAt,
    }));
  }),

  /**
   * Everything the client needs to decide whether to offer the "aktifkan
   * notifikasi" button: the VAPID public key (null when the deployment has no
   * keys, so push is simply not offered) and whether *this* browser is already
   * subscribed.
   */
  pushConfig: protectedProcedure
    .input(z.object({ endpoint: z.string().max(2000).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const publicKey = getVapidPublicKey();
      if (!publicKey) {
        return { enabled: false, publicKey: null, subscribed: false };
      }

      const subscribed = input?.endpoint
        ? await pushQueries.hasPushSubscription(ctx.appUser!.id, input.endpoint)
        : false;

      return { enabled: true, publicKey, subscribed };
    }),

  subscribePush: protectedProcedure
    .input(pushSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      if (!isPushConfigured()) {
        // Not an error worth failing on — the UI just keeps the bell.
        return { success: false, message: 'Notifikasi push belum dikonfigurasi.' };
      }

      await pushQueries.upsertPushSubscription({
        userId: ctx.appUser!.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: ctx.requestMeta?.userAgent ?? null,
      });

      // The endpoint is a device address, not content — the audit entry records
      // that notifications were switched on, not where they are delivered.
      ctx.audit.set({
        ringkasan: `Mengaktifkan notifikasi push untuk akun ${ctx.appUser!.email}`,
      });

      return { success: true, message: 'Notifikasi diaktifkan untuk perangkat ini.' };
    }),

  unsubscribePush: protectedProcedure
    .input(z.object({ endpoint: z.string().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await pushQueries.deletePushSubscriptionForUser(ctx.appUser!.id, input.endpoint);

      ctx.audit.set({
        ringkasan: `Menonaktifkan notifikasi push untuk akun ${ctx.appUser!.email}`,
      });

      return { success: true, message: 'Notifikasi dinonaktifkan untuk perangkat ini.' };
    }),
});
