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
import { SignedIn, SignedOut } from "./auth/SessionGate";
import Link from "next/link";
import Image from "next/image";
import { Reveal } from "./Reveal";
import { Parallax } from "./Parallax";

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
          {/* Deliberately NOT wrapped in <Reveal>: this block is the LCP element
              and is on screen from the first paint, so fading it in would only
              delay the largest paint and leave the heading at opacity-0 for any
              renderer that never fires an IntersectionObserver. */}
          <div className="text-center lg:text-left">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Pemerintah Kabupaten Kutai Timur
            </p>
            {/* The `{' '}` is load-bearing: the span is `block`, so browsers and
                Google render a line break, but a parser reading `textContent`
                would otherwise see "InformasiAdministrasi" as one token. */}
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
              Sistem Informasi{' '}
              <span className="mt-1 block bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                Administrasi Pertanahan
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 sm:text-lg lg:mx-0">
              Platform digital Pemerintah Kabupaten Kutai Timur untuk registrasi,
              verifikasi, pendataan, dan penerbitan{' '}
              <strong className="font-semibold text-gray-900">
                SPPTG — Surat Pernyataan Penguasaan Tanah Garapan
              </strong>{' '}
              bagi masyarakat dan aparatur desa.
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
          </div>

          {/* Hero illustration. Above the fold as well, so it skips <Reveal>
              for the same reason as the copy block, and is marked priority
              because it is the other LCP candidate. */}
          <div className="relative">
            {/* Soft halo so the illustration's faded edges sit on something */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-6 -z-10 rounded-full bg-blue-200/40 blur-3xl"
            />
            <Image
              src="/imgs/illustrator-1.png"
              alt="Petugas desa memverifikasi bidang tanah lewat peta digital, dokumen berkas, dan sertifikat SPPTG"
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 40rem, 100vw"
              className="h-auto w-full max-w-xl mx-auto lg:max-w-none"
              priority
            />
          </div>
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

      {/* ------------------------------------------------------- Tentang SPPTG */}
      {/* Answers the questions people (and answer engines) actually ask before
          "how does the wizard work": what the document is, who may apply, and
          what to bring. Every claim here is drawn from the wizard's own rules. */}
      {/* `bg-gray-50/60` stays as the paint-behind: the artwork is opaque, so it
          covers this entirely once loaded, but the section keeps its tint while
          the (lazy, below-fold) image is still on the wire. */}
      <section
        id="tentang-spptg"
        className="relative overflow-hidden bg-gray-50/60"
      >
        {/* Two layers, not one: the globe half stays put while the satellite
            drifts and parallaxes. Separate files because a single <img> cannot
            move one of its own regions. */}
        <Image
          src="/imgs/illustrator-layanan-bumi.png"
          alt=""
          aria-hidden
          width={1536}
          height={1024}
          sizes="100vw"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />

        {/* Positioned against the section, not against the base image: the base
            is `object-cover`, so its crop shifts with the viewport and anything
            pinned to image coordinates would drift out of place. The satellite
            was erased from the base, so there is no hole to line up with — only
            empty wash, which reads correctly wherever this lands up here. */}
        {/* `top-16` is not arbitrary: the section clips overflow and the
            parallax lifts this by up to `distance`, so the resting offset has
            to exceed that or the satellite shears off at the top edge. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-10 -right-10 w-[56%] opacity-45 sm:top-20 sm:right-[6%] sm:w-[24%] sm:max-w-[280px] sm:opacity-100"
        >
          <Parallax distance={-40}>
            <Image
              src="/imgs/illustrator-layanan-satelit.png"
              alt=""
              width={383}
              height={312}
              sizes="(min-width: 640px) 400px, 44vw"
              className="animate-satellite-drift h-auto w-full select-none"
            />
          </Parallax>
        </div>

        {/* The artwork is already near-white; this only lifts the globe corner
            enough that body copy keeps its contrast where the two overlap. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white/45"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-36 lg:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Tentang Layanan
            </p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
              Apa itu SPPTG?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600">
              <strong className="font-semibold text-gray-900">
                SPPTG — Surat Pernyataan Penguasaan Tanah Garapan
              </strong>{' '}
              adalah dokumen resmi yang diterbitkan Pemerintah Kabupaten Kutai
              Timur untuk mencatat penguasaan sebidang tanah garapan oleh warga.
              Dokumen ini menerangkan siapa yang menguasai lahan, di mana
              letaknya, dan berapa luasnya — lengkap dengan batas bidang yang
              sudah diukur dan diperiksa terhadap kawasan yang tidak boleh
              diterbitkan SPPTG.
            </p>
            <p className="mt-3 text-base leading-relaxed text-gray-600">
              SIAPTAH memindahkan seluruh prosesnya ke satu alur digital, dari
              pengunggahan berkas sampai sertifikat SPPTG siap unduh, sehingga
              pemohon tidak perlu bolak-balik hanya untuk menanyakan posisi
              berkasnya.
            </p>
          </Reveal>

          <dl className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            <Reveal className="rounded-2xl border border-gray-200 bg-white/90 p-6 backdrop-blur-sm">
              <dt className="font-semibold text-gray-900">Siapa yang bisa mengajukan</dt>
              <dd className="mt-2 text-sm leading-relaxed text-gray-600">
                Warga Kabupaten Kutai Timur yang menggarap tanah dan membutuhkan
                bukti tertulis atas penguasaannya. Anda dapat mendaftar sendiri
                lewat tombol Daftar, atau memakai akun yang dibuatkan admin desa
                bila pengajuan dibantu aparatur desa.
              </dd>
            </Reveal>

            <Reveal delay={80} className="rounded-2xl border border-gray-200 bg-white/90 p-6 backdrop-blur-sm">
              <dt className="font-semibold text-gray-900">Dokumen yang disiapkan</dt>
              <dd className="mt-2 text-sm leading-relaxed text-gray-600">
                <span className="font-medium text-gray-900">KTP</span> dan{' '}
                <span className="font-medium text-gray-900">Kartu Keluarga</span>{' '}
                wajib diunggah. Siapkan pula kwitansi, surat permohonan, dan
                surat pernyataan tidak sengketa — templat ketiganya bisa diunduh
                langsung dari dalam aplikasi.
              </dd>
            </Reveal>

            <Reveal delay={160} className="rounded-2xl border border-gray-200 bg-white/90 p-6 backdrop-blur-sm">
              <dt className="font-semibold text-gray-900">Cara batas lahan dicatat</dt>
              <dd className="mt-2 text-sm leading-relaxed text-gray-600">
                Batas bidang digambar langsung di peta, diimpor dari berkas
                KML/KMZ hasil pengukuran, atau diketik sebagai koordinat
                geografis maupun UTM. Sistem lalu memeriksa tumpang tindih
                dengan Hutan Lindung, Sempadan Sungai, Tanah Pemerintah, dan
                kawasan Non-SPPTG lain, serta menghitung luasnya dalam m².
              </dd>
            </Reveal>
          </dl>
        </div>
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
      <section className="relative overflow-hidden">
        {/* Illustration backdrop. Its subjects sit at the far left/right and the
            middle is transparent, so the heading stays on clean white; the scrim
            below keeps the cards readable where they overlap the artwork. */}
        <Image
          src="/imgs/illustrator-2.png"
          alt=""
          aria-hidden
          width={1536}
          height={1024}
          sizes="100vw"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover opacity-60"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white/55"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
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
                  className="group rounded-2xl border border-gray-200 bg-white/90 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:bg-white hover:shadow-xl"
                >
                  <div
                    className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors group-hover:text-white ${feature.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {feature.description}
                  </p>
                </Reveal>
              );
            })}
          </div>
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
      {/* The gradient stays as the paint-behind: the illustration is blue edge
          to edge, so the section never flashes white while it loads. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500">
        <Image
          src="/imgs/illustrator-3.png"
          alt=""
          aria-hidden
          width={1536}
          height={1024}
          sizes="100vw"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
        />
        {/* Darkens the artwork just enough for white copy to stay legible */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-blue-700/25"
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
          {/* The lockup's wordmark and tagline are dark navy, which all but
              disappears on gray-900. The light plate is what keeps it legible
              without a separate inverted artwork. */}
          <span className="inline-flex rounded-xl bg-white px-3 py-2">
            <Image
              src="/SIPETA_LOGO_NAVBAR.png"
              alt="SIAPTAH — Sistem Informasi Administrasi Pertanahan"
              width={1492}
              height={559}
              sizes="160px"
              className="h-8 w-auto sm:h-9"
            />
          </span>
          <div className="text-sm">
            {/* The only outbound link on the page. A service run by a pemda that
                cites no authority at all is a weak trust signal. */}
            <a
              href="https://kutaitimurkab.go.id"
              className="underline decoration-gray-600 underline-offset-4 transition-colors hover:text-white"
            >
              Situs resmi Pemerintah Kabupaten Kutai Timur
            </a>
            <p className="mt-2">
              &copy; {new Date().getFullYear()} Pemerintah Kabupaten Kutai Timur.
              Hak Cipta Dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
