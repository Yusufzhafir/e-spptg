/**
 * Cek koneksi SMTP dari luar Next.js.
 *
 *   node scripts/smtp-check.mjs                  # verifikasi login saja
 *   node scripts/smtp-check.mjs tujuan@mail.com  # verifikasi + kirim email uji
 *
 * Membaca .env.development.local secara manual — `dotenv/config` di db.ts
 * membaca `.env` yang tidak ada di repo ini.
 */
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config({ path: process.env.ENV_FILE || '.env.development.local' });

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || process.env.GMAIL_USER;
const pass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
const fromName = process.env.MAIL_FROM_NAME || 'SIAPTAH';
const fromAddress = process.env.MAIL_FROM_ADDRESS || user;

if (!user || !pass) {
  console.error('SMTP_USER/SMTP_PASSWORD belum diatur.');
  process.exit(1);
}

const transporter = nodemailer.createTransport(
  host
    ? { host, port, secure, auth: { user, pass } }
    : { service: 'gmail', auth: { user, pass } }
);

console.log(`Menghubungi ${host || 'smtp.gmail.com'}:${host ? port : 465} (secure=${secure}) sebagai ${user}`);
await transporter.verify();
console.log('✓ Koneksi + autentikasi SMTP berhasil.');

const to = process.argv[2];
if (to) {
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: 'Uji Coba SMTP SIAPTAH',
    text: `Email uji dari konfigurasi SMTP SIAPTAH (${host || 'gmail'}:${port}).\nDikirim ${new Date().toISOString()}.`,
  });
  console.log(`✓ Email uji terkirim ke ${to} — messageId ${info.messageId}`);
  console.log(`  respons server: ${info.response}`);
}

transporter.close();
