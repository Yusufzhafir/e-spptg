'use client';

import './globals.css';
import { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ClerkProvider } from '@clerk/nextjs';
import { TRPCProvider } from '@/trpc/client';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <TRPCProvider>
        <html lang="en">
          <body>
            <Toaster position="top-right" />
            {children}
          </body>
        </html>
      </TRPCProvider>
    </ClerkProvider>
  );
}
