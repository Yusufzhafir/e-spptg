'use client';

import { useCallback, useEffect, useState } from 'react';
import { trpc } from '@/trpc/client';

/**
 * Browser/PWA push notifications.
 *
 * Three things have to line up before the toggle is worth showing, and each can
 * fail independently:
 *  1. the browser supports the Push API (iOS only does so for an *installed*
 *     PWA, and only from iOS 16.4),
 *  2. a service worker is registered (`ServiceWorkerRegistrar`, production only),
 *  3. the deployment has VAPID keys (`notifications.pushConfig`).
 *
 * `isSupported === false` is a normal state, not an error — the in-app bell
 * keeps working either way.
 */

/**
 * The VAPID key travels as base64url; `pushManager.subscribe` wants bytes.
 * Backed by an explicit ArrayBuffer so the result is a `BufferSource` — a plain
 * `new Uint8Array(n)` widens to `ArrayBufferLike`, which the DOM types reject.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushNotificationsState = {
  /** Push is usable in this browser at all. */
  isSupported: boolean;
  /** The server has VAPID keys, so subscribing can succeed. */
  isConfigured: boolean;
  /** This browser is subscribed for the signed-in user. */
  isSubscribed: boolean;
  /** Notification.permission, or null before it can be read. */
  permission: NotificationPermission | null;
  isBusy: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

export function usePushNotifications(): PushNotificationsState {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [endpoint, setEndpoint] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);
  // Set optimistically by subscribe/unsubscribe so the button flips at once;
  // the query below is the source of truth on load.
  const [localSubscribed, setLocalSubscribed] = useState<boolean | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    // Both are only knowable after mount — the server has no `navigator`.
    setIsSupported(supported);
    if (!supported) return;
    setPermission(Notification.permission);

    let cancelled = false;
    // Read the endpoint this browser already holds, if any, so the server can
    // say whether it is registered for the signed-in account.
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription() ?? null)
      .then((subscription) => {
        if (!cancelled) setEndpoint(subscription?.endpoint);
      })
      .catch(() => {
        /* No registration yet — the toggle will register one on demand. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { data: config, refetch: refetchConfig } =
    trpc.notifications.pushConfig.useQuery(
      { endpoint },
      { enabled: isSupported, refetchOnWindowFocus: false }
    );

  const subscribeMutation = trpc.notifications.subscribePush.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribePush.useMutation();

  const subscribe = useCallback(async () => {
    if (!isSupported || !config?.publicKey) return;
    setIsBusy(true);
    try {
      // `serviceWorker.ready` never settles when nothing is registered, which
      // is the normal state in development (`ServiceWorkerRegistrar` only runs
      // in production). Fail with a message instead of a spinner that hangs.
      const registered = await navigator.serviceWorker.getRegistration();
      if (!registered) {
        throw new Error(
          'Service worker belum aktif di peramban ini, jadi notifikasi perangkat belum dapat diaktifkan.'
        );
      }

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        throw new Error(
          'Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di peramban Anda.'
        );
      }

      const registration = await navigator.serviceWorker.ready;
      // An existing subscription made with a different (rotated) VAPID key
      // cannot be reused — drop it and take a fresh one.
      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
      });

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('Peramban tidak memberikan data langganan yang lengkap.');
      }

      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setEndpoint(json.endpoint);
      setLocalSubscribed(true);
      void refetchConfig();
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, config?.publicKey, subscribeMutation, refetchConfig]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = (await registration?.pushManager.getSubscription()) ?? null;
      const currentEndpoint = subscription?.endpoint ?? endpoint;

      if (subscription) await subscription.unsubscribe();
      // Forget the row even when the browser had already dropped the
      // subscription, otherwise the server keeps pushing to a dead endpoint.
      if (currentEndpoint) {
        await unsubscribeMutation.mutateAsync({ endpoint: currentEndpoint });
      }

      setEndpoint(undefined);
      setLocalSubscribed(false);
      void refetchConfig();
    } finally {
      setIsBusy(false);
    }
  }, [isSupported, endpoint, unsubscribeMutation, refetchConfig]);

  return {
    isSupported,
    isConfigured: Boolean(config?.enabled),
    isSubscribed: localSubscribed ?? Boolean(config?.subscribed),
    permission,
    isBusy,
    subscribe,
    unsubscribe,
  };
}
