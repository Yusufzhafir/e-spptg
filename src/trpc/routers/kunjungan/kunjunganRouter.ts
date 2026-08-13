import { publicProcedure, router } from '../../init';
import { getVisitStats } from '@/server/db/queries/page-visits';
import { cached } from '@/server/redis/cache';
import { key } from '@/server/redis/client';

/**
 * Visit statistics for the public landing page.
 *
 * `publicProcedure`, deliberately: the card sits on a page anyone can open, and
 * everything it returns is an aggregate — counts, top browsers, top referrer
 * hosts. No visitor address, no path list, nothing per person. There is nothing
 * here a signed-out visitor should not see, and requiring a session would mean
 * the public page could never show it.
 *
 * Read client-side rather than baked into the prerendered HTML on purpose: `/`
 * is ISR'd for fifteen minutes, and "Pengunjung Aktif (5 menit terakhir)" frozen
 * for fifteen minutes would be a lie. The Redis entry below is what keeps that
 * from meaning one query per visitor.
 */

/** Short enough that "active in the last 5 minutes" still means something. */
const TTL_STATISTIK = 30;

export const kunjunganRouter = router({
  statistik: publicProcedure.query(async () => {
    // One shared key, not a `scopedKey()`: these numbers are identical for every
    // caller, so a scope digest would only fragment a single entry.
    return cached(key('kunjungan', 'statistik'), TTL_STATISTIK, () => getVisitStats());
  }),
});
