import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outbound mail goes through Gmail SMTP — the one third-party service the app
 * still talks to, because "reset sandi lewat Gmail" is a product requirement.
 *
 * `GMAIL_APP_PASSWORD` must be a Google App Password (16 characters, 2FA on the
 * account); Gmail rejects the normal account password over SMTP.
 */
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'SIAPTAH';

let transporter: Transporter | null = null;

/** Whether mail is configured at all; lets callers degrade instead of throwing. */
export function isMailerConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function getTransporter(): Transporter {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error(
      'GMAIL_USER dan GMAIL_APP_PASSWORD belum diatur — email tidak dapat dikirim.'
    );
  }

  // Created lazily and cached: nodemailer pools connections, and building a
  // transport per email would open a new TLS session every time.
  transporter ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  return transporter;
}

/**
 * The app's own origin, used to build absolute links in emails. Falls back to
 * the dev server so a local "lupa sandi" still produces a clickable link.
 */
export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.APP_DOMAIN) return `https://${process.env.APP_DOMAIN}`;
  return 'http://localhost:3000';
}

async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  await getTransporter().sendMail({
    from: `"${MAIL_FROM_NAME}" <${GMAIL_USER}>`,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

function layout(title: string, bodyHtml: string): string {
  return `
<div style="margin:0;padding:24px;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;font-weight:600;">SIAPTAH</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${title}</h1>
    ${bodyHtml}
    <hr style="margin:28px 0 16px;border:none;border-top:1px solid #e5e7eb;" />
    <p style="margin:0;font-size:12px;color:#9ca3af;">
      Email ini dikirim otomatis oleh Sistem Informasi Administrasi Pertanahan. Mohon tidak membalas email ini.
    </p>
  </div>
</div>`.trim();
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a></p>`;
}

/**
 * The "lupa sandi" email. The link carries the raw token; everything the server
 * kept is its digest, so this message is the only copy in existence.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  nama: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const url = `${appBaseUrl()}/atur-ulang-sandi?token=${encodeURIComponent(params.token)}`;
  const minutes = Math.max(1, Math.round((params.expiresAt.getTime() - Date.now()) / 60000));

  await sendMail({
    to: params.to,
    subject: 'Atur Ulang Kata Sandi SIAPTAH',
    text: [
      `Halo ${params.nama},`,
      '',
      'Kami menerima permintaan untuk mengatur ulang kata sandi akun SIAPTAH Anda.',
      `Buka tautan berikut untuk membuat kata sandi baru (berlaku ${minutes} menit):`,
      url,
      '',
      'Jika Anda tidak meminta ini, abaikan email ini — kata sandi Anda tidak berubah.',
    ].join('\n'),
    html: layout(
      'Atur Ulang Kata Sandi',
      `
      <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">Halo <strong>${params.nama}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#374151;">
        Kami menerima permintaan untuk mengatur ulang kata sandi akun Anda. Klik tombol di bawah untuk membuat kata sandi baru.
      </p>
      ${button(url, 'Atur Ulang Kata Sandi')}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        Tautan ini berlaku selama <strong>${minutes} menit</strong> dan hanya dapat dipakai satu kali.
        Jika Anda tidak meminta ini, abaikan email ini — kata sandi Anda tidak berubah.
      </p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;word-break:break-all;">
        Tombol tidak berfungsi? Salin tautan ini ke peramban: ${url}
      </p>`
    ),
  });
}

/**
 * Sent right after self-registration. Until this link is opened the account
 * exists but cannot sign in, so the message has to be unambiguous about being
 * the required next step rather than an optional confirmation.
 */
export async function sendEmailVerificationEmail(params: {
  to: string;
  nama: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const url = `${appBaseUrl()}/verifikasi-email?token=${encodeURIComponent(params.token)}`;
  const hours = Math.max(1, Math.round((params.expiresAt.getTime() - Date.now()) / 3_600_000));

  await sendMail({
    to: params.to,
    subject: 'Verifikasi Email Akun SIAPTAH Anda',
    text: [
      `Halo ${params.nama},`,
      '',
      'Terima kasih telah mendaftar di SIAPTAH.',
      `Verifikasi alamat email Anda melalui tautan berikut (berlaku ${hours} jam):`,
      url,
      '',
      'Akun Anda belum dapat digunakan untuk masuk sampai email ini diverifikasi.',
      '',
      'Jika Anda tidak merasa mendaftar, abaikan email ini.',
    ].join('\n'),
    html: layout(
      'Verifikasi Email Anda',
      `
      <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">Halo <strong>${params.nama}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#374151;">
        Terima kasih telah mendaftar di SIAPTAH. Satu langkah lagi: klik tombol di bawah
        untuk membuktikan bahwa alamat email ini milik Anda.
      </p>
      ${button(url, 'Verifikasi Email')}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        Tautan berlaku selama <strong>${hours} jam</strong> dan hanya dapat dipakai satu kali.
        <strong>Akun Anda belum dapat dipakai untuk masuk sampai email ini diverifikasi.</strong>
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
        Jika Anda tidak merasa mendaftar, abaikan email ini — akun tersebut tidak akan pernah aktif.
      </p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;word-break:break-all;">
        Tombol tidak berfungsi? Salin tautan ini ke peramban: ${url}
      </p>`
    ),
  });
}

/**
 * Sent whenever an admin creates an account — there is no other way in, since an
 * admin cannot set an initial password. Opening the link both sets the first
 * password and verifies the address, so this one message is the account's whole
 * activation path.
 */
export async function sendAccountInviteEmail(params: {
  to: string;
  nama: string;
  peran: string;
  token: string;
  expiresAt: Date;
}): Promise<void> {
  const url = `${appBaseUrl()}/atur-ulang-sandi?token=${encodeURIComponent(params.token)}`;
  const minutes = Math.max(1, Math.round((params.expiresAt.getTime() - Date.now()) / 60000));

  await sendMail({
    to: params.to,
    subject: 'Akun SIAPTAH Anda Telah Dibuat',
    text: [
      `Halo ${params.nama},`,
      '',
      `Akun SIAPTAH Anda telah dibuat dengan peran ${params.peran}.`,
      `Buat kata sandi Anda melalui tautan berikut (berlaku ${minutes} menit):`,
      url,
      '',
      'Membuka tautan ini sekaligus memverifikasi alamat email Anda.',
      `Setelah itu Anda dapat masuk menggunakan email ${params.to}.`,
    ].join('\n'),
    html: layout(
      'Akun Anda Telah Dibuat',
      `
      <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;">Halo <strong>${params.nama}</strong>,</p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#374151;">
        Akun SIAPTAH Anda telah dibuat dengan peran <strong>${params.peran}</strong>.
        Buat kata sandi terlebih dahulu untuk mulai menggunakan akun.
      </p>
      ${button(url, 'Buat Kata Sandi')}
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        Tautan berlaku selama <strong>${minutes} menit</strong> dan sekaligus memverifikasi
        alamat email Anda. Setelah kata sandi dibuat, Anda dapat masuk menggunakan email
        <strong>${params.to}</strong>.
      </p>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9ca3af;word-break:break-all;">
        Tombol tidak berfungsi? Salin tautan ini ke peramban: ${url}
      </p>`
    ),
  });
}
