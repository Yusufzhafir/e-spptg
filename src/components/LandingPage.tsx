"use client";

import {
  Map,
  FileText,
  ShieldAlert,
  BarChart3,
  Layers,
  History,
  ArrowRight,
  MapPin,
  ClipboardCheck,
  Award,
} from "lucide-react";
import { Button } from "./ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "./Reveal";

/** The four wizard stages a pengajuan moves through. */
const steps = [
  {
    icon: FileText,
    accent: 'from-sky-500 to-blue-600',
    title: "Berkas",
    description:
      "Data pemohon dan dokumen wajib — KTP, KK, kwitansi, surat permohonan, dan surat pernyataan tidak sengketa.",
  },
  {
    icon: MapPin,
    accent: 'from-violet-500 to-purple-600',
    title: "Lapangan",
    description:
      "Batas bidang tanah digambar di peta, diimpor dari KML/KMZ, atau diketik dalam koordinat geografis maupun UTM.",
  },
  {
    icon: ClipboardCheck,
    accent: 'from-amber-500 to-orange-600',
    title: "Hasil",
    description:
      "Pengecekan tumpang tindih berbasis PostGIS terhadap kawasan Non-SPPTG, lalu verifikator menetapkan statusnya.",
  },
  {
    icon: Award,
    accent: 'from-emerald-500 to-green-600',
    title: "Terbitkan SPPTG",
    description:
      "Nomor sertifikat dibuat otomatis dan dokumen SPPTG dirender menjadi PDF resmi siap unduh.",
  },
];

const features = [
  {
    icon: Map,
    accent: 'bg-sky-50 text-sky-600 group-hover:bg-sky-600',
    title: "Peta Sebaran Lahan",
    description:
      "Seluruh bidang tanah tervisualisasi di satu peta interaktif, lengkap dengan legenda status dan tautan ke detail pengajuan.",
  },
  {
    icon: ShieldAlert,
    accent: 'bg-red-50 text-red-600 group-hover:bg-red-600',
    title: "Deteksi Kawasan Terlarang",
    description:
      "Polygon pengajuan diuji otomatis terhadap Hutan Lindung, Sempadan Sungai, Tanah Pemerintah, dan kawasan lain — luas tumpang tindih dihitung dalam m².",
  },
  {
    icon: Layers,
    accent: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600',
    title: "Data Desa Terpusat",
    description:
      "Referensi desa, kecamatan, tim juru ukur, hingga kawasan Non-SPPTG dikelola dalam satu tempat dan dipakai ulang di setiap pengajuan.",
  },
  {
    icon: BarChart3,
    accent: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600',
    title: "Dashboard & Statistik",
    description:
      "KPI per status, tren pengajuan bulanan, serta filter desa, status, dan rentang tanggal yang konsisten di seluruh tampilan.",
  },
  {
    icon: History,
    accent: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600',
    title: "Jejak Audit",
    description:
      "Setiap perubahan status tercatat lengkap dengan petugas, waktu, dan alasan — wajib diisi untuk penolakan maupun peninjauan ulang.",
  },
  {
    icon: FileText,
    accent: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600',
    title: "Dokumen Resmi",
    description:
      "Template surat tersedia untuk diunduh, dan sertifikat SPPTG dihasilkan sebagai PDF berformat resmi.",
  },
];

const statuses = [
  {
    label: "SPPTG terdata",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    hint: "Sudah tercatat, menunggu keputusan verifikator.",
  },
  {
    label: "SPPTG terdaftar",
    className: "bg-green-100 text-green-800 border-green-200",
    hint: "Lolos verifikasi dan siap diterbitkan sertifikatnya.",
  },
  {
    label: "SPPTG ditinjau ulang",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    hint: "Dikembalikan ke pemohon dengan catatan perbaikan.",
  },
  {
    label: "SPPTG ditolak",
    className: "bg-red-100 text-red-800 border-red-200",
    hint: "Tidak memenuhi syarat, disertai alasan penolakan.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ---------------------------------------------------------------- Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/70 shadow-[0_1px_3px_rgb(0_0_0/0.04)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="SIAPTAH — kembali ke beranda"
            className="group flex min-w-0 items-center gap-2.5 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <span className="relative shrink-0">
              {/* Soft halo that warms up on hover */}
              <span
                aria-hidden
                className="absolute -inset-1 rounded-xl bg-blue-500/0 transition-colors group-hover:bg-blue-500/10"
              />
              <Image
                src="/SIPETA_LOGO.png"
                alt="SIAPTAH logo"
                width={40}
                height={40}
                className="relative h-9 w-9 sm:h-10 sm:w-10"
                priority
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-gray-900 sm:text-lg">
                SIAPTAH
              </span>
              <span className="hidden truncate text-xs leading-tight text-gray-500 sm:block">
                Sistem Informasi Administrasi Pertanahan
              </span>
            </span>
          </Link>

          {/* No navigation links by design — the only actions are sign in / sign up. */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SignedOut>
              <Button
                asChild
                variant="ghost"
                className="px-3 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 sm:px-4"
              >
                <Link href="/sign-in">Masuk</Link>
              </Button>
              <Button
                asChild
                className="bg-blue-600 px-4 font-medium shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/25 sm:px-5"
              >
                <Link href="/sign-up">Daftar</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                asChild
                className="bg-blue-600 px-4 font-medium shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-md sm:px-5"
              >
                <Link href="/app">Buka Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        {/* Soft background wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_50%_-10%,theme(colors.blue.100),transparent)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:px-8 lg:py-24">
          <Reveal direction="right" className="text-center lg:text-left">
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Sistem Informasi
              <span className="mt-1 block bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                Administrasi Pertanahan
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 sm:text-lg lg:mx-0">
              Platform digital untuk memudahkan proses registrasi, verifikasi,
              pendataan dan pengelolaan Surat Keterangan Tanah (SKT) bagi
              masyarakat dan pemerintah daerah.
            </p>

            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
              <SignedOut>
                <Button
                  asChild
                  size="lg"
                  className="bg-blue-600 px-7 text-base hover:bg-blue-700"
                >
                  <Link href="/sign-up">
                    Daftar Sekarang
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="px-7 text-base"
                >
                  <Link href="/sign-in">Masuk ke Akun</Link>
                </Button>
              </SignedOut>
              <SignedIn>
                <Button
                  asChild
                  size="lg"
                  className="bg-blue-600 px-7 text-base hover:bg-blue-700"
                >
                  <Link href="/app">
                    Buka Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </SignedIn>
            </div>
          </Reveal>

          {/* Stylised product preview (pure CSS — no screenshot needed) */}
          <Reveal direction="left" delay={150} className="relative">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl shadow-blue-900/10 sm:p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              </div>

              {/* Faux map with an overlapping prohibited zone */}
              <div className="relative h-44 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 via-sky-50 to-blue-100 sm:h-56">
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox="0 0 400 220"
                  aria-hidden
                >
                  <defs>
                    <pattern
                      id="grid"
                      width="28"
                      height="28"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M28 0H0V28"
                        fill="none"
                        stroke="rgb(148 163 184 / 0.25)"
                      />
                    </pattern>
                  </defs>
                  <rect width="400" height="220" fill="url(#grid)" />
                  <polygon
                    points="60,150 130,60 250,80 230,180 110,190"
                    fill="rgb(37 99 235 / 0.22)"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                  />
                  <polygon
                    points="210,40 340,60 320,150 220,130"
                    fill="rgb(239 68 68 / 0.18)"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="6 4"
                  />
                </svg>
                <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5 text-[10px]">
                  <span className="inline-flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 font-medium text-gray-700 shadow-sm">
                    <span className="h-2 w-2 rounded-sm bg-blue-600" /> Bidang
                    tanah
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 font-medium text-gray-700 shadow-sm">
                    <span className="h-2 w-2 rounded-sm bg-red-500" /> Kawasan
                    Non-SPPTG
                  </span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- Angka ringkas */}
      <section className="relative overflow-hidden bg-gray-900">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl"
        />
      </section>

      {/* ------------------------------------------------------------- Alur kerja */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Alur Pengajuan
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Empat tahap, satu berkas digital
            </h2>
            <p className="mt-3 text-gray-600">
              Data tersimpan otomatis di setiap tahap, sehingga pengajuan bisa
              dilanjutkan kapan saja tanpa kehilangan progres.
            </p>
          </Reveal>

          <div className="relative mt-12">
            {/* Connector line running behind the step markers (desktop only) */}
            <div
              aria-hidden
              className="absolute left-0 right-0 top-6 hidden h-0.5 bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 opacity-30 lg:block"
            />
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <Reveal
                    key={step.title}
                    delay={index * 120}
                    className="relative"
                  >
                    <li>
                    {/* Numbered marker sits on the connector */}
                    <div
                      className={`relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${step.accent} text-white shadow-lg lg:mx-0`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-gray-700 shadow ring-1 ring-gray-200">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 text-center font-semibold text-gray-900 lg:text-left">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-center text-sm leading-relaxed text-gray-600 lg:text-left">
                      {step.description}
                    </p>
                    </li>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- Fitur */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Kemampuan
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Dibangun untuk pekerjaan pertanahan yang sebenarnya
          </h2>
          <p className="mt-3 text-gray-600">
            Bukan sekadar formulir digital — setiap fitur menjawab kebutuhan
            verifikasi di lapangan.
          </p>
        </div>

        {/* Bento layout: the differentiator gets a wide dark tile, the rest follow */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal
                key={feature.title}
                delay={index * 80}
                className="group rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div
                  className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors group-hover:text-white ${feature.accent}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {feature.description}
                </p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------- Status pengajuan */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Status Pengajuan
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Selalu jelas posisi setiap berkas
            </h2>
            <p className="mt-3 text-gray-600">
              Status berubah hanya melalui verifikator berwenang, dan setiap
              keputusan penolakan maupun peninjauan ulang wajib disertai alasan.
            </p>
          </Reveal>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statuses.map((status, index) => (
              <Reveal
                key={status.label}
                delay={index * 90}
                className={`rounded-xl border-2 bg-white p-4 text-center transition-transform hover:-translate-y-1 ${status.className.replace(/bg-\S+/, '')}`}
              >
                <span
                  className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
                <p className="mt-3 text-xs leading-relaxed text-gray-600">
                  {status.hint}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]"
        />
        <Reveal className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Siap mulai mendata?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-blue-50">
            Buat akun untuk mengajukan berkas, atau masuk bila akun Anda sudah
            didaftarkan oleh admin desa.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <SignedOut>
              <Button
                asChild
                size="lg"
                className="bg-white px-7 text-base text-blue-700 hover:bg-blue-50"
              >
                <Link href="/sign-up">Daftar Sekarang</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/70 bg-transparent px-7 text-base text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/sign-in">Masuk</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button
                asChild
                size="lg"
                className="bg-white px-7 text-base text-blue-700 hover:bg-blue-50"
              >
                <Link href="/app">Buka Dashboard</Link>
              </Button>
            </SignedIn>
          </div>
        </Reveal>
      </section>

      {/* --------------------------------------------------------------- Footer */}
      <footer className="bg-gray-900 py-10 text-gray-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6 md:flex-row md:justify-between md:text-left lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/SIPETA_LOGO.png"
              alt="SIAPTAH logo"
              width={36}
              height={36}
              className="h-9 w-9"
            />
            <div>
              <p className="font-semibold text-white">SIAPTAH</p>
              <p className="text-xs">
                Sistem Informasi Administrasi Pertanahan
              </p>
            </div>
          </div>
          <p className="text-sm">
            &copy; {new Date().getFullYear()} Pemerintah Daerah. Hak Cipta
            Dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}
