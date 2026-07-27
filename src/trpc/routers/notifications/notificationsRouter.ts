import { protectedProcedure, router } from '../../init';
import * as notificationQueries from '@/server/db/queries/notifications';

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
});
