import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

/**
 * The card people see when the link is pasted into WhatsApp, Facebook or
 * Telegram. Generated rather than shipped as a file so it stays in sync with the
 * site's wording, and drawn purely with CSS — no font or image is fetched, which
 * keeps it working on a server with no outbound internet access.
 *
 * Applies to every route that does not define its own; the private routes are
 * noindex anyway, so one card for the whole site is the right amount.
 */
export const alt = `${SITE_NAME} — ${SITE_TAGLINE} Kabupaten Kutai Timur`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 55%, #0ea5e9 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: '#bfdbfe',
            display: 'flex',
          }}
        >
          Pemerintah Kabupaten Kutai Timur
        </div>
        <div style={{ fontSize: 104, fontWeight: 700, marginTop: 24, display: 'flex' }}>
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 44, marginTop: 8, color: '#e0f2fe', display: 'flex' }}>
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            marginTop: 40,
            paddingTop: 32,
            borderTop: '2px solid rgba(255,255,255,0.25)',
            fontSize: 30,
            lineHeight: 1.4,
            color: '#dbeafe',
            display: 'flex',
          }}
        >
          Pendaftaran, verifikasi, dan penerbitan SPPTG — Surat Pernyataan
          Penguasaan Tanah Garapan
        </div>
      </div>
    ),
    size
  );
}
