'use client';

import { useEffect } from 'react';

/**
 * Reports one page view to `POST /api/kunjungan`. Renders nothing.
 *
 * `sendBeacon` rather than `fetch`: it is fire-and-forget, the browser keeps it
 * alive across the navigation that may follow immediately, and it cannot block
 * anything on the page. `fetch(keepalive)` is the fallback for the few browsers
 * without it.
 *
 * The delayed send doubles as the Strict Mode guard: React runs effects twice in
 * development, and cancelling the pending timer in cleanup means the discarded
 * first pass never reaches the network — otherwise every figure on the card
 * would read double while developing.
 */
export function VisitTracker() {
  useEffect(() => {
    let dibatalkan = false;

    // A frame late on purpose: the beacon must never compete with the LCP image
    // for the connection.
    const timer = window.setTimeout(() => {
      if (dibatalkan) return;

      const payload = JSON.stringify({ path: window.location.pathname });
      const blob = new Blob([payload], { type: 'application/json' });

      if (navigator.sendBeacon?.('/api/kunjungan', blob)) return;

      void fetch('/api/kunjungan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // A counter that fails is not the visitor's problem.
      });
    }, 1200);

    return () => {
      dibatalkan = true;
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
