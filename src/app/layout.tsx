import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Providers } from './providers';
import {
  SITE_DESCRIPTION,
  SITE_META_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from '@/lib/site';

export const metadata: Metadata = {
  // Makes every relative URL below — canonical, OG image, manifest — resolve to
  // an absolute one. Without it Next emits relative OG tags, which crawlers and
  // chat apps ignore, and a canonical tag cannot be expressed at all.
  metadataBase: new URL(SITE_URL),
  // Pages set their own title; this template appends the app name.
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  // The short form: this one becomes <meta name="description">, which Google clips.
  description: SITE_META_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  // Public by default; the private routes each opt out, and robots.ts disallows
  // them as well. `max-image-preview: large` is what allows a rich result.
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Drives the preview card in WhatsApp, Facebook and Telegram — the channels a
  // pemda actually socialises a service through.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE} Kabupaten Kutai Timur`,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'id_ID',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE} Kabupaten Kutai Timur`,
    description: SITE_DESCRIPTION,
  },
  // Google Search Console's meta-tag method. Read at *build* time because "/"
  // is prerendered; unset simply emits no tag, which is the correct behaviour
  // for anyone verifying by HTML file or DNS record instead.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE_NAME,
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  // Keeps the bottom nav clear of the iOS home indicator
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
