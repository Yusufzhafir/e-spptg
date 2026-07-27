import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import type { ReactNode } from 'react';

interface AuthShellProps {
  /** Headline shown on the branded panel. */
  title: string;
  subtitle: string;
  /** Selling points listed under the headline. */
  points: string[];
  children: ReactNode;
}

/**
 * Split layout for the Clerk sign-in / sign-up screens: form on the left,
 * branded context on the right. The panel is hidden below `lg` so phones and
 * tablets get the form full-width instead of a squeezed two-column view.
 */
export function AuthShell({ title, subtitle, points, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* ------------------------------------------------------------ Form side */}
      <div className="flex w-full flex-col px-5 py-8 sm:px-8 lg:w-1/2 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/SIPETA_LOGO.png"
              alt="SIAPTAH logo"
              width={40}
              height={40}
              className="h-9 w-9"
              priority
            />
            <div className="leading-tight">
              <p className="font-semibold text-gray-900">SIAPTAH</p>
              <p className="hidden text-xs text-gray-500 sm:block">
                Sistem Informasi Administrasi Pertanahan
              </p>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Beranda</span>
          </Link>
        </div>

        {/* Clerk renders its own card; center it in the remaining space */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <p className="text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Pemerintah Daerah. Hak Cipta Dilindungi.
        </p>
      </div>

      {/* --------------------------------------------------------- Branded side */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]"
        />
        {/* Faint map motif, echoing the product's core surface */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
          viewBox="0 0 400 600"
          preserveAspectRatio="xMidYMid slice"
        >
          <polygon
            points="40,240 150,120 300,160 270,340 120,380"
            fill="rgb(255 255 255 / 0.10)"
            stroke="rgb(255 255 255 / 0.55)"
            strokeWidth="2"
          />
          <polygon
            points="230,90 380,130 350,260 250,220"
            fill="rgb(255 255 255 / 0.06)"
            stroke="rgb(255 255 255 / 0.4)"
            strokeWidth="2"
            strokeDasharray="7 5"
          />
        </svg>

        <div className="relative flex h-full flex-col justify-center px-12 xl:px-20">
          <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">{title}</h2>
          <p className="mt-4 max-w-md text-blue-50">{subtitle}</p>

          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-blue-50">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check className="h-3 w-3 text-white" />
                </span>
                <span className="text-sm">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
