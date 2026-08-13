'use client';

import { ExternalLink, FileCheck2, Map, ShieldCheck, Users } from 'lucide-react';
import { Reveal } from '../Reveal';

/** The four things the app is, in one line each — the visual half of the section. */
const sorotan = [
  {
    icon: Users,
    title: 'Verifikasi identitas pemohon',
    description: 'Berkas KTP dan Kartu Keluarga diperiksa dalam satu alur.',
  },
  {
    icon: Map,
    title: 'Validasi bidang berbasis GIS',
    description: 'Batas lahan digambar, diimpor, atau diketik sebagai koordinat.',
  },
  {
    icon: ShieldCheck,
    title: 'Pemeriksaan kawasan',
    description: 'Tumpang tindih dengan kawasan Non-SPPTG dihitung otomatis.',
  },
  {
    icon: FileCheck2,
    title: 'Dokumen SPPTG resmi',
    description: 'Sertifikat dirender sebagai PDF siap unduh dan arsip.',
  },
];

export function TentangKamiSection() {
  return (
    // `overflow-x-hidden` is load bearing, not tidiness: the two <Reveal>s below
    // slide in horizontally, so until they fire they sit 24px outside their
    // column. On a 390px screen that is 8px past the viewport edge, and the
    // whole page gains a horizontal scrollbar until the reader scrolls this far.
    // Clipping the section contains the offset without touching the animation.
    <section
      id="tentang-kami"
      className="relative scroll-mt-20 overflow-x-hidden bg-white sm:scroll-mt-24"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-14 lg:px-8">
        {/* -------------------------------------------------- Panel identitas */}
        {/* A composed panel rather than a photograph: the landing page's other
            artwork is full-bleed backdrop material, and stretching one of those
            into a portrait card crops its subjects out of frame. */}
        <Reveal direction="right" className="relative">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-sky-500 p-8 shadow-xl shadow-blue-600/20 sm:p-10">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-sky-300/20"
            />
            <p className="relative mt-6 text-lg font-semibold leading-relaxed text-white">
              Satu alur digital untuk seluruh proses SPPTG di Kabupaten Kutai
              Timur.
            </p>

            <ul className="relative mt-7 space-y-4">
              {sorotan.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-inset ring-white/25">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-blue-50/90">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>

        {/* ------------------------------------------------------------ Narasi */}
        <Reveal direction="left">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Tentang Kami
          </p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            Tentang Aplikasi SIAPTAH
          </h2>

          <p className="mt-5 text-base leading-relaxed text-gray-600">
            Aplikasi{' '}
            <strong className="font-semibold text-gray-900">SIAPTAH</strong>{' '}
            adalah Sistem Informasi Administrasi Pertanahan yang dikembangkan
            untuk{' '}
            <strong className="font-semibold text-gray-900">
              Dinas Pertanahan dan Penataan Ruang Kabupaten Kutai Timur
            </strong>{' '}
            guna mempercepat dan mempermudah proses pendataan, verifikasi, serta
            penerbitan{' '}
            <strong className="font-semibold text-gray-900">
              SPPTG — Surat Pernyataan Penguasaan Tanah Garapan
            </strong>{' '}
            secara daring, baik untuk pengajuan yang diurus mandiri oleh warga
            maupun yang dibantu aparatur desa.
          </p>

          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Fitur utama aplikasi ini meliputi manajemen berkas pengajuan,
            verifikasi identitas pemohon, validasi batas bidang tanah berbasis
            GIS, hingga peta bidang digital yang dapat ditelusuri per desa. Setiap
            bidang yang diajukan diperiksa terhadap kawasan yang tidak boleh
            diterbitkan SPPTG — Kawasan Hutan, Sempadan Sungai, Tanah Pemerintah,
            dan lainnya — sebelum dokumen SPPTG resmi diterbitkan dalam format
            PDF beserta lampiran peta dan daftar koordinatnya.
          </p>

          <p className="mt-4 text-base leading-relaxed text-gray-600">
            Seluruh perubahan status dicatat sebagai jejak audit lengkap dengan
            petugas, waktu, dan alasannya, sehingga posisi setiap berkas dapat
            dipertanggungjawabkan dari pengajuan sampai penerbitan.
          </p>

          <a
            href="https://www.kutaitimurkab.go.id"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 pointer-coarse:min-h-11 pointer-coarse:py-2.5 transition-colors hover:bg-blue-100"
          >
            Pemerintah Kabupaten Kutai Timur
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
