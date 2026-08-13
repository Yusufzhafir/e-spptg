import 'server-only';
import {
  getRegisteredPolygons,
  getRegisteredStatsByVillage,
} from '@/server/db/queries/submissions';
import { TTL, cached, scopedKey } from '@/server/redis/cache';
import { summarizeLandingStats, type LandingStats } from '@/lib/landing-stats';

/**
 * The numbers behind the landing page's "Data Statistik" section.
 *
 * Two layers of staleness, both intentional:
 *
 * 1. The page itself is ISR'd (`export const revalidate` in `src/app/page.tsx`),
 *    so most visitors are served prerendered HTML and never reach this at all.
 * 2. When a regeneration does run, the result is read through Redis under the
 *    `dash:` prefix — which means `invalidateDashboard()` already drops it on
 *    every submission write, exactly like the in-app KPI cards.
 *
 * Returns `null` instead of throwing: a database that is unreachable must not
 * take down the *public* page of a government service. The section then renders
 * its "belum tersedia" state and the rest of the landing page is unaffected.
 */
export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    return await cached(scopedKey('landing-terdaftar', {}), TTL.dashboard, async () => {
      // Both halves of the same picture, so they are read together and cached
      // together — a map that disagreed with the table beside it would read as
      // a bug even when both were momentarily correct.
      const [perDesa, polygons] = await Promise.all([
        getRegisteredStatsByVillage(),
        getRegisteredPolygons(),
      ]);
      return summarizeLandingStats(perDesa, polygons);
    });
  } catch (error) {
    console.error('[landing-stats] gagal membaca statistik publik:', error);
    return null;
  }
}
