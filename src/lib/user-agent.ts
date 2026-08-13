/**
 * Minimal user-agent classification for the visit counter.
 *
 * Hand-rolled rather than a dependency because only three coarse facts are ever
 * shown — browser family, OS family, device class — and all three are read off a
 * handful of tokens. Anything a rule misses is reported as `Tidak diketahui`,
 * never guessed: an honest "unknown" slice is better than a wrong bar.
 *
 * Two known limits, both inherent to the UA string rather than to this parser:
 * Windows 10 and 11 both report `Windows NT 10.0` and cannot be told apart, and
 * modern iPadOS identifies itself as a Mac. Chromium browsers all carry the
 * `Chrome` token, so the derived brands (Edge, Opera, Samsung, Brave) have to be
 * matched *before* Chrome, and Safari last of all.
 */

export const TIDAK_DIKETAHUI = 'Tidak diketahui';

/** Order matters: every entry below Chrome also contains the Chrome token. */
const BROWSERS: [RegExp, string][] = [
  [/\bEdgA?\/|\bEdge\//i, 'Edge'],
  [/\bOPR\/|\bOpera\b/i, 'Opera'],
  [/\bSamsungBrowser\//i, 'Samsung Internet'],
  [/\bYaBrowser\//i, 'Yandex'],
  [/\bUCBrowser\//i, 'UC Browser'],
  [/\bFirefox\/|\bFxiOS\//i, 'Firefox'],
  [/\bCriOS\/|\bChrome\//i, 'Chrome'],
  [/\bSafari\//i, 'Safari'],
];

const SISTEM_OPERASI: [RegExp, string][] = [
  // Android must precede Linux — every Android UA also says Linux.
  [/\bAndroid\b/i, 'Android'],
  [/\b(iPhone|iPad|iPod)\b/i, 'iOS'],
  [/\bWindows NT 10\.0\b/i, 'Windows 10'],
  [/\bWindows NT 6\.3\b/i, 'Windows 8.1'],
  [/\bWindows NT 6\.1\b/i, 'Windows 7'],
  [/\bWindows\b/i, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/i, 'macOS'],
  [/\bCrOS\b/i, 'ChromeOS'],
  [/\bLinux\b/i, 'Linux'],
];

export type PerangkatKelas = 'Desktop' | 'Ponsel' | 'Tablet';

/**
 * Crawlers, uptime checks and preview fetchers. They are excluded from the
 * counter entirely: a portal whose "kunjungan" number is mostly Googlebot tells
 * the office nothing about how many people it reached.
 */
const BOT = /bot|crawler|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot|preview|monitor|curl|wget|python-requests|headlesschrome|lighthouse|pingdom|uptime/i;

export function adalahBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // No UA at all is a script, not a browser.
  return BOT.test(userAgent);
}

export function browserDari(userAgent: string | null | undefined): string {
  if (!userAgent) return TIDAK_DIKETAHUI;
  for (const [pola, nama] of BROWSERS) {
    if (pola.test(userAgent)) return nama;
  }
  return TIDAK_DIKETAHUI;
}

export function sistemOperasiDari(userAgent: string | null | undefined): string {
  if (!userAgent) return TIDAK_DIKETAHUI;
  for (const [pola, nama] of SISTEM_OPERASI) {
    if (pola.test(userAgent)) return nama;
  }
  return TIDAK_DIKETAHUI;
}

export function perangkatDari(userAgent: string | null | undefined): PerangkatKelas {
  if (!userAgent) return 'Desktop';
  if (/\biPad\b|\bTablet\b|\bPlayBook\b/i.test(userAgent)) return 'Tablet';
  // "Android" without "Mobile" is a tablet, per Google's own guidance.
  if (/\bAndroid\b/i.test(userAgent) && !/\bMobile\b/i.test(userAgent)) return 'Tablet';
  if (/\bMobi|\biPhone\b|\biPod\b|\bWindows Phone\b/i.test(userAgent)) return 'Ponsel';
  return 'Desktop';
}

export type JenisRujukan = 'internal' | 'langsung' | 'eksternal';

export type Rujukan = {
  jenis: JenisRujukan;
  /** Host of an external referrer; null for internal and direct visits. */
  host: string | null;
};

/**
 * Classifies where a visit came from.
 *
 * `internal` means the visitor moved within this site, which the reference
 * dashboard shows as "Navigasi" — it is a page view, but not a new arrival.
 * A referrer we cannot parse is treated as direct rather than as an unnamed
 * external source, because an unparsable value is far more often junk than a
 * real site.
 */
export function klasifikasiRujukan(
  referer: string | null | undefined,
  hostSendiri: string | null | undefined
): Rujukan {
  if (!referer) return { jenis: 'langsung', host: null };

  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { jenis: 'langsung', host: null };
  }

  const sendiri = (hostSendiri ?? '').toLowerCase().replace(/^www\./, '').split(':')[0];
  if (host && sendiri && host === sendiri) return { jenis: 'internal', host: null };

  return { jenis: 'eksternal', host };
}
