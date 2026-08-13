"use client";

import { Fragment } from "react";
import {
  FileText,
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
import { LandingHeader } from "./landing/LandingHeader";
import { LandingFooter } from "./landing/LandingFooter";
import { TentangKamiSection } from "./landing/TentangKamiSection";
import { StatistikSection } from "./landing/StatistikSection";
import { PetaSebaranSection } from "./landing/PetaSebaranSection";
import { StatistikKunjunganSection } from "./landing/StatistikKunjunganSection";
import { VisitTracker } from "./landing/VisitTracker";
import type { LandingStats } from "@/lib/landing-stats";

/**
 * The four wizard stages a pengajuan moves through.
 *
 * `rel` is the step's segment of the rail, `angka` its ordinal and glyph
 * colour. Both are written out as whole class names because Tailwind reads the
 * source as text; an interpolated `text-${warna}-600` compiles to nothing.
 */
const steps = [
  {
    icon: FileText,
    rel: 'bg-sky-500',
    angka: 'text-sky-600',
    title: "Berkas",
    description:
      "Data pemohon dan dokumen wajib — KTP, KK, surat asal usul kwitansi jual beli/hibah/keterangan waris/bukti lain, dan surat permohonan.",
  },
  {
    icon: MapPin,
    rel: 'bg-violet-500',
    angka: 'text-violet-600',
    title: "Lapangan",
    description:
      "Batas bidang tanah digambar di peta, diimpor dari KML/KMZ, atau diketik dalam koordinat geografis maupun UTM.",
  },
  {
    icon: ClipboardCheck,
    rel: 'bg-amber-500',
    angka: 'text-amber-600',
    title: "Hasil",
    description:
      "Pengecekan tumpang tindih berbasis PostGIS terhadap kawasan Non-SPPTG, lalu verifikator menetapkan statusnya.",
  },
  {
    icon: Award,
    rel: 'bg-emerald-500',
    angka: 'text-emerald-600',
    title: "Terbitkan SPPTG",
    description:
      "Nomor sertifikat dibuat otomatis dan dokumen SPPTG dirender menjadi PDF resmi siap unduh.",
  },
];

/** The three things people ask before starting, in the order they ask them. */
const ketentuan = [
  {
    judul: 'Siapa yang bisa mengajukan',
    isi: (
      <>
        Warga Kabupaten Kutai Timur yang menggarap tanah dan membutuhkan bukti
        tertulis atas penguasaannya. Anda dapat mendaftar sendiri lewat tombol
        Daftar, atau memakai akun yang dibuatkan admin desa bila pengajuan
        dibantu aparatur desa.
      </>
    ),
  },
  {
    judul: 'Dokumen yang disiapkan',
    isi: (
      <>
        <span className="font-medium text-gray-900">KTP</span> dan{' '}
        <span className="font-medium text-gray-900">Kartu Keluarga</span> wajib
        diunggah. Siapkan pula surat asal usul kwitansi jual
        beli/hibah/keterangan waris/bukti lain dan surat permohonan. Surat
        pernyataan tidak sengketa bersifat opsional, templatnya bisa diunduh
        langsung dari dalam aplikasi.
      </>
    ),
  },
  {
    judul: 'Cara batas lahan dicatat',
    isi: (
      <>
        Batas bidang digambar langsung di peta, diimpor dari berkas KML/KMZ hasil
        pengukuran, atau diketik sebagai koordinat geografis maupun UTM. Sistem
        lalu memeriksa tumpang tindih dengan Kawasan Hutan, Sempadan Sungai,
        Tanah Pemerintah, dan kawasan Non-SPPTG lain, serta menghitung luasnya
        dalam m².
      </>
    ),
  },
];

/**
 * The status lifecycle, drawn the way it actually branches instead of as four
 * equal boxes: two states are the road a berkas travels, two are the exits it
 * can be sent down. Colours match `StatusBadge` inside the app, so a status
 * looks the same here as it does on the officer's screen.
 */
const jalurUtama = [
  {
    label: "SPPTG terdata",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    titik: "bg-blue-500",
    hint: "Berkas sudah tercatat di sistem dan menunggu keputusan verifikator.",
  },
  {
    label: "SPPTG terdaftar",
    badge: "bg-green-100 text-green-800 border-green-200",
    titik: "bg-emerald-500",
    hint: "Lolos verifikasi, resmi terdaftar, dan siap diterbitkan sertifikatnya.",
  },
];

const jalurLain = [
  {
    label: "SPPTG ditinjau ulang",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    titik: "bg-amber-500",
    hint: "Dikembalikan ke pemohon dengan catatan perbaikan, lalu bisa diajukan lagi.",
  },
  {
    label: "SPPTG ditolak",
    badge: "bg-red-100 text-red-800 border-red-200",
    titik: "bg-red-500",
    hint: "Tidak memenuhi syarat. Alasan penolakan wajib dicantumkan.",
  },
];

/**
 * `stats` is read on the server by `src/app/page.tsx` and passed in, so the
 * numbers are already in the prerendered HTML — a client-side fetch would leave
 * search engines (and anyone on a slow connection) looking at empty cards.
 * `null` means the read failed; the section renders its own empty state.
 */
export function LandingPage({ stats }: { stats: LandingStats | null }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Renders nothing; reports this page view to /api/kunjungan, which is
          what feeds the "Statistik Kunjungan" card below. */}
      <VisitTracker />
      <LandingHeader />

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

      {/* --------------------------------------------------------- Tentang kami */}
      {/* Replaces an "Angka ringkas" section that held nothing but two absolutely
          positioned decorations — it collapsed to zero height and rendered as
          nothing at all. */}
      <TentangKamiSection />


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

          {/* One panel divided into three, not three cards floating on the
              artwork: the three answers belong to one question ("apa yang perlu
              saya tahu sebelum mengajukan"), and three identical bordered boxes
              said the opposite. The hairline dividers carry the separation, the
              numerals carry the rhythm, and the first column is wider because
              its answer is the one everybody reads first. */}
          <Reveal className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <dl className="grid divide-y divide-gray-200/80 lg:grid-cols-[1.15fr_1fr_1fr] lg:divide-x lg:divide-y-0">
              {ketentuan.map((item, index) => (
                <div
                  key={item.judul}
                  className="group px-5 py-6 transition-colors duration-300 ease-out hover:bg-blue-50/50 sm:px-8 sm:py-7"
                >
                  <span className="text-xs font-semibold tabular-nums tracking-widest text-blue-600/70">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <dt className="mt-2 text-lg font-semibold leading-snug text-gray-900">
                    {item.judul}
                  </dt>
                  {/* Grows on hover instead of a border appearing: the rule is
                      part of the layout at rest, so nothing shifts. */}
                  <span
                    aria-hidden
                    className="mt-3 block h-px w-10 bg-blue-600/30 transition-all duration-300 ease-out group-hover:w-16 group-hover:bg-blue-600/70"
                  />
                  <dd className="mt-3 text-sm leading-relaxed text-gray-600">
                    {item.isi}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ Statistik */}
      {/* Three cards under one anchor: the recap, the map of where those parcels
          are, and how many people opened this page. `#statistik` stays on the
          first of them — that is what the header links to. */}
      <StatistikSection stats={stats} />
      <PetaSebaranSection
        polygons={stats?.polygons ?? []}
        jumlahBidang={stats?.polygons.length ?? 0}
      />
      <StatistikKunjunganSection />

      {/* --------------------------------------- Alur kerja & status pengajuan */}
      {/* One section, not two: the four stages and the four statuses describe the
          same journey — what happens, then how it ends — and the shared backdrop
          (kept from the section that used to sit between them) is what ties the
          halves together. */}
      <section className="relative overflow-hidden">
        {/* Illustration backdrop. Its subjects sit at the far left/right and the
            middle is transparent, so the headings stay on clean white; the scrim
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
        {/* Heavier than the 55% this artwork carried when it sat behind six
            short feature cards: the merged section puts four columns of body
            copy over the surveyor figures, and body text needs more separation
            from a busy illustration than a heading does. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-white/70"
        />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          {/* ----------------------------------------- Status pengajuan */}
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

          {/* Jalur utama: two states, joined, weighted heavier than the exits
              below because this is what happens to most berkas. */}
          <div className="mx-auto mt-10 flex max-w-4xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {jalurUtama.map((status, index) => (
              <Fragment key={status.label}>
                {/* The connector is what makes these two a path rather than two
                    cards: terdata is where a berkas waits, terdaftar is where it
                    arrives. It turns to point downward once the row stacks. */}
                {index > 0 && (
                  <span
                    aria-hidden
                    className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-500 shadow-sm sm:mx-0"
                  >
                    <ArrowRight className="h-4 w-4 rotate-90 sm:rotate-0" />
                  </span>
                )}
                <Reveal
                  delay={index * 120}
                  className="group flex-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.titik}`}
                    />
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">
                    {status.hint}
                  </p>
                </Reveal>
              </Fragment>
            ))}
          </div>

          {/* Jalur lain: quieter on purpose. These are exits, not milestones,
              and a berkas that lands here is waiting on a person, not on the
              system. One panel with a divider rather than two more cards. */}
          <Reveal
            delay={220}
            className="mx-auto mt-4 max-w-4xl overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50/80"
          >
            <p className="px-5 pt-4 text-xs font-medium text-gray-500">
              Bila berkas belum memenuhi syarat
            </p>
            <div className="grid divide-y divide-gray-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {jalurLain.map((status) => (
                <div key={status.label} className="px-5 pb-4 pt-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full ${status.titik}`}
                    />
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.badge}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-gray-600">
                    {status.hint}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* -------------------------------------------- Alur pengajuan */}
          <Reveal className="mx-auto mt-20 max-w-2xl text-center">
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

          {/* The ordinal carries the step, not an icon tile. Each column owns a
              segment of the rail above it, so the rail reads as four stages of
              one journey rather than a decorative line drawn behind badges. */}
          <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={index * 120}>
                  <li className="group">
                    <span
                      aria-hidden
                      className={`block h-1 w-full rounded-full ${step.rel} opacity-70 transition-opacity duration-300 ease-out group-hover:opacity-100`}
                    />
                    <div className="mt-5 flex items-baseline gap-3">
                      <span
                        className={`text-4xl font-bold leading-none tabular-nums ${step.angka}`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                        <Icon className={`h-4 w-4 shrink-0 ${step.angka}`} />
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">
                      {step.description}
                    </p>
                  </li>
                </Reveal>
              );
            })}
          </ol>
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
      <LandingFooter />
    </div>
  );
}
