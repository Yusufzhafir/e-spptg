'use client';

import { useEffect } from 'react';

/**
 * Registers the PWA service worker. Renders nothing.
 *
 * Registered in development too: without a service worker the browser refuses
 * to subscribe to push at all, so "Notifikasi Perangkat" could never be tested
 * outside a production build — and the permission prompt never even appeared,
 * because the subscribe flow gives up before asking.
 *
 * That is safe here because `public/sw.js` caches almost nothing: API traffic
 * is skipped outright, navigations always hit the network (the cache is only an
 * offline fallback), and the only cached responses are images and fonts, served
 * stale-while-revalidate. No HTML or JS is cached, so hot reloading is
 * unaffected.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Gagal mendaftarkan service worker:', error);
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
