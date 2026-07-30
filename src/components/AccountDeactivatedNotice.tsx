'use client';

import Image from 'next/image';
import { SignOutButton } from '@clerk/nextjs';
import { ShieldOff } from 'lucide-react';
import { ACCOUNT_DEACTIVATED_MESSAGE } from '@/lib/account-status';

/**
 * Shown in place of the whole app shell when a signed-in user's account has been
 * set to 'Nonaktif'. Every tRPC call they make is refused, so rendering the
 * dashboard would only produce a wall of failed requests — say what happened and
 * offer the one action that still makes sense.
 */
export function AccountDeactivatedNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <Image
          src="/SIPETA_LOGO.png"
          alt="SIAPTAH logo"
          width={40}
          height={40}
          className="mx-auto h-10 w-10"
        />

        <span className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <ShieldOff className="h-6 w-6 text-red-600" />
        </span>

        <h1 className="mt-4 text-xl font-semibold text-gray-900">Akun Dinonaktifkan</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {ACCOUNT_DEACTIVATED_MESSAGE}
        </p>

        <SignOutButton>
          <button className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700">
            Keluar
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}
