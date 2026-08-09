import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Halaman Tidak Ditemukan' };

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white">
      {/* Soft background wash, matching the landing hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_35rem_at_50%_-10%,theme(colors.blue.100),transparent)]"
      />

      <header className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="SIAPTAH — kembali ke beranda"
          className="inline-flex items-center"
        >
          <Image
            src="/SIPETA_LOGO_NAVBAR.png"
            alt=""
            width={1492}
            height={559}
            sizes="(min-width: 640px) 150px, 120px"
            className="h-11 w-auto sm:h-14"
            priority
          />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg text-center">
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 sm:h-20 sm:w-20">
            <MapPinOff className="h-8 w-8 sm:h-10 sm:w-10" />
          </div>

          <p className="text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl">404</p>
          <h1 className="mt-3 text-xl font-semibold text-gray-900 sm:text-2xl">
            Halaman tidak ditemukan
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-gray-600 sm:text-base">
            Alamat yang Anda tuju tidak tersedia, sudah dipindahkan, atau mungkin salah ketik.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" variant="outline">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Beranda
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="relative py-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Pemerintah Daerah. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}
