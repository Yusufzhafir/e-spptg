import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ReactNode } from 'react';
import { Providers } from './providers';

const APP_NAME = 'SIAPTAH';
const APP_DESCRIPTION =
  'Sistem Informasi Administrasi Pertanahan — pendaftaran dan penerbitan SPPTG.';

export const metadata: Metadata = {
  // Pages set their own title; this template appends the app name.
  title: {
    default: `${APP_NAME} — Sistem Informasi Administrasi Pertanahan`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  icons: {
    icon: '/SIPETA_LOGO.png',
    apple: '/SIPETA_LOGO.png',
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
