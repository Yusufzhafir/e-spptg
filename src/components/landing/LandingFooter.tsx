'use client';

import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';

/** Alamat kantor Dinas Pertanahan dan Penataan Ruang Kabupaten Kutai Timur. */
const ALAMAT = [
  'Jl. Prof. Dr. Baharuddin Lopa, S.H.',
  'Tlk. Lingga, Kec. Sangatta Utara',
  'Kabupaten Kutai Timur, Kalimantan Timur',
];

const TAUTAN = [
  { label: 'Provinsi Kalimantan Timur', href: 'https://kaltimprov.go.id' },
  { label: 'Pemkab Kutai Timur', href: 'https://www.kutaitimurkab.go.id' },
];

/**
 * ⚠️ PLACEHOLDER — ganti dengan kontak resmi Dinas sebelum rilis publik.
 *
 * These two values are a template so the layout is in place, not real contact
 * details. Publishing an invented address for a public service is worse than
 * publishing none: someone will write to it. They are deliberately kept out of
 * `SITE_CONTACT` (the JSON-LD graph) for the same reason — search engines would
 * repeat them as the agency's official channel. Fill both in here *and* in
 * `src/lib/site.ts` when the real ones are known.
 */
const KONTAK = {
  email: 'siaptah@kutaitimurkab.go.id',
  telepon: '(0549) 000 0000',
};

/**
 * Two columns: the agency's identity and links on the left, the office location
 * on the right.
 *
 * `id="kontak"` is the target of the header's "Kontak" link, so the anchor has
 * to stay on the element that actually holds the address.
 */
export function LandingFooter() {
  return (
    <footer id="kontak" className="scroll-mt-20 bg-gray-900 text-gray-400 sm:scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
          {/* ------------------------------------------------ Kolom identitas */}
          <div>

            <p className="mt-5 max-w-md text-sm leading-relaxed">
              Sistem Informasi Administrasi Pertanahan Kabupaten Kutai Timur
              untuk pendataan, verifikasi, dan penerbitan SPPTG.
            </p>

            <div className="mt-8 grid gap-8 sm:grid-cols-2">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                  Alamat
                </h2>
                <address className="mt-3 space-y-0.5 text-sm not-italic leading-relaxed">
                  <p className="font-medium text-gray-300">
                    Dinas Pertanahan dan Penataan Ruang
                  </p>
                  {ALAMAT.map((baris) => (
                    <p key={baris}>{baris}</p>
                  ))}
                </address>

                <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-white">
                  Kontak
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    <a
                      href={`mailto:${KONTAK.email}`}
                      className="inline-flex items-center truncate text-sky-400 transition-colors hover:text-sky-300 pointer-coarse:min-h-11"
                    >
                      {KONTAK.email}
                    </a>
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                    {/* `tel:` needs the digits without the spacing. */}
                    <a
                      href={`tel:${KONTAK.telepon.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center text-sky-400 transition-colors hover:text-sky-300 pointer-coarse:min-h-11"
                    >
                      {KONTAK.telepon}
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-white">
                  Link terkait
                </h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {TAUTAN.map((tautan) => (
                    <li key={tautan.href}>
                      <a
                        href={tautan.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sky-400 transition-colors hover:text-sky-300 pointer-coarse:min-h-11"
                      >
                        {tautan.label}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>

                <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-white">
                  Feedback
                </h2>
                <p className="mt-3 text-sm leading-relaxed">
                  Silakan mengirim email kepada kami jika Anda membutuhkan
                  informasi mengenai layanan SPPTG, atau datang langsung ke
                  kantor Dinas pada hari kerja.
                </p>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------- Kolom peta */}
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white">
              <MapPin className="h-4 w-4 text-sky-400" />
              Lokasi kantor
            </h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-gray-800">
              {/* `loading="lazy"` matters here: the map is the heaviest thing on
                  the page and sits below every section, so it must never
                  compete with the hero for bandwidth. */}
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3989.654411302942!2d117.59620286292206!3d0.5193546334723695!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x320a4b211553173b%3A0x58acdf452d99208a!2sDINAS%20PERTANAHAN%20DAN%20PENATAAN%20RUANG%20KUTAI%20TIMUR!5e0!3m2!1sid!2sid!4v1786612122639!5m2!1sid!2sid"
                title="Peta lokasi Dinas Pertanahan dan Penataan Ruang Kabupaten Kutai Timur"
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="h-72 w-full border-0 lg:h-[22rem]"
              />
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm sm:text-left">
          &copy; {new Date().getFullYear()} Aplikasi SIAPTAH Kabupaten Kutai
          Timur — Hak Cipta Dilindungi.
        </div>
      </div>
    </footer>
  );
}
