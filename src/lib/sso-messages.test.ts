import { SSO_ERROR_MESSAGES, ssoErrorMessage } from './sso-messages';

describe('ssoErrorMessage', () => {
  it('tidak menampilkan apa pun kalau tidak ada kode', () => {
    expect(ssoErrorMessage(null)).toBeNull();
    expect(ssoErrorMessage(undefined)).toBeNull();
    expect(ssoErrorMessage('')).toBeNull();
  });

  it('menerjemahkan setiap kode yang dikenal', () => {
    for (const code of Object.keys(SSO_ERROR_MESSAGES)) {
      expect(ssoErrorMessage(code), `kode ${code}`).toBe(
        SSO_ERROR_MESSAGES[code as keyof typeof SSO_ERROR_MESSAGES]
      );
    }
  });

  it('memakai pesan umum untuk kode yang tidak dikenal', () => {
    expect(ssoErrorMessage('kode-karangan')).toBe(SSO_ERROR_MESSAGES.gagal);
  });

  it('tidak pernah menampilkan teks kiriman penyerang', () => {
    // Inti dari memakai kode, bukan pesan, di query string: halaman masuk milik
    // domain go.id tidak boleh bisa disuruh menampilkan kalimat orang lain.
    const jahat = 'Akun Anda diblokir. Hubungi 0812-XXXX untuk membuka.';
    expect(ssoErrorMessage(jahat)).toBe(SSO_ERROR_MESSAGES.gagal);
    expect(ssoErrorMessage(jahat)).not.toContain('0812');
  });
});
