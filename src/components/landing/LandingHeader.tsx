'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { SignedIn, SignedOut } from '../auth/SessionGate';

/**
 * In-page navigation. Each href is an anchor on this same page, so the targets
 * live in `LandingPage` (`#tentang-kami`, `#statistik`) and `LandingFooter`
 * (`#kontak`) — renaming a section id without changing it here silently turns
 * the link into a no-op.
 */
const NAV = [
  { label: 'Tentang Kami', href: '#tentang-kami' },
  { label: 'Statistik', href: '#statistik' },
  { label: 'Kontak', href: '#kontak' },
];

/**
 * Which section the reader is currently in, for the underline in the nav.
 *
 * An IntersectionObserver over the three targets rather than a scroll handler:
 * the browser does the geometry off the main thread, so this cannot make the
 * page stutter while scrolling. The top margin matches the sticky header's own
 * height, so a section counts as "current" when it clears the header rather than
 * when it touches the top of the window.
 */
function useSeksiAktif(): string | null {
  const [aktif, setAktif] = useState<string | null>(null);

  useEffect(() => {
    const target = NAV.map((item) => document.querySelector(item.href)).filter(
      (node): node is Element => node !== null
    );
    if (target.length === 0) return;

    const terlihat = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          terlihat.set(`#${entry.target.id}`, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        // The most-visible section wins; ties go to whichever comes first in the
        // nav, which is the reading order down the page.
        let pilihan: string | null = null;
        let terbesar = 0;
        for (const item of NAV) {
          const rasio = terlihat.get(item.href) ?? 0;
          if (rasio > terbesar) {
            terbesar = rasio;
            pilihan = item.href;
          }
        }
        setAktif(pilihan);
      },
      { rootMargin: '-72px 0px -45% 0px', threshold: [0, 0.15, 0.35, 0.6, 1] }
    );

    for (const node of target) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return aktif;
}

export function LandingHeader() {
  const [menuTerbuka, setMenuTerbuka] = useState(false);
  const seksiAktif = useSeksiAktif();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/70 shadow-[0_1px_3px_rgb(0_0_0/0.04)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        {/* The lockup already carries the name and the tagline, so the link
            needs no text of its own — the aria-label speaks for it. */}
        <Link
          href="/"
          aria-label="SIAPTAH — kembali ke beranda"
          className="flex min-w-0 items-center rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Image
            src="/SIPETA_LOGO_NAVBAR.png"
            alt=""
            width={1492}
            height={559}
            // Without this Next assumes the image may fill the viewport and
            // serves the 1920px variant for a ~150px slot — 80 KB instead of
            // 14 KB, preloaded, competing with the LCP image for bandwidth.
            sizes="(min-width: 640px) 150px, 120px"
            className="h-11 w-auto sm:h-14"
            priority
          />
        </Link>

        {/* Desktop navigation. Below `lg` the same links live in the panel
            below, so they are never simply unavailable. */}
        <nav aria-label="Navigasi halaman" className="hidden lg:flex lg:items-center lg:gap-1">
          {NAV.map((item) => {
            const aktif = seksiAktif === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                // `aria-current` is the part a screen reader gets; the underline
                // below is the same information for everyone else.
                aria-current={aktif ? 'true' : undefined}
                className={`group relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  aktif ? 'text-blue-700' : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {item.label}
                {/* One element that scales on the x axis rather than a width
                    transition: `transform` is composited, so the underline
                    cannot cost a layout pass on a sticky header that repaints
                    while the page scrolls. It grows from the centre. */}
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 origin-center rounded-full bg-blue-600 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                    aktif ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  }`}
                />
              </a>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SignedOut>
            {/* Hidden on the narrowest screens so the logo, the primary action
                and the menu button still fit; the panel repeats it. */}
            <Button
              asChild
              variant="ghost"
              className="hidden px-3 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 pointer-coarse:min-h-11 sm:inline-flex sm:px-4"
            >
              <Link href="/sign-in">Masuk</Link>
            </Button>
            <Button
              asChild
              className="bg-blue-600 px-4 font-medium shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/25 pointer-coarse:min-h-11 sm:px-5"
            >
              <Link href="/sign-up">Daftar</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button
              asChild
              className="bg-blue-600 px-4 font-medium shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-md pointer-coarse:min-h-11 sm:px-5"
            >
              <Link href="/app">Buka Dashboard</Link>
            </Button>
          </SignedIn>

          <button
            type="button"
            onClick={() => setMenuTerbuka((terbuka) => !terbuka)}
            aria-expanded={menuTerbuka}
            aria-controls="menu-navigasi-mobile"
            aria-label={menuTerbuka ? 'Tutup menu' : 'Buka menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none lg:hidden"
          >
            {menuTerbuka ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Rendered only while open: an always-mounted panel would keep its links
          in the tab order behind the closed menu. */}
      {menuTerbuka && (
        <nav
          id="menu-navigasi-mobile"
          aria-label="Navigasi halaman"
          className="border-t border-gray-200/70 bg-white/95 backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            {NAV.map((item) => {
              const aktif = seksiAktif === item.href;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setMenuTerbuka(false)}
                    aria-current={aktif ? 'true' : undefined}
                    // The panel has no room for an underline, so the current
                    // section is marked by a tinted row instead.
                    className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      aktif
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
            <SignedOut>
              <li className="sm:hidden">
                <Link
                  href="/sign-in"
                  onClick={() => setMenuTerbuka(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                >
                  Masuk ke Akun
                </Link>
              </li>
            </SignedOut>
          </ul>
        </nav>
      )}
    </header>
  );
}
