import { positiveIntFromEnv } from './env-number';

describe('positiveIntFromEnv', () => {
  it('memakai nilai yang sah', () => {
    expect(positiveIntFromEnv('200', 10)).toBe(200);
    expect(positiveIntFromEnv('1', 10)).toBe(1);
  });

  it('kembali ke bawaan saat variabel tidak diisi', () => {
    expect(positiveIntFromEnv(undefined, 10)).toBe(10);
    expect(positiveIntFromEnv('', 10)).toBe(10);
    expect(positiveIntFromEnv('   ', 10)).toBe(10);
  });

  it('kembali ke bawaan untuk masukan yang tidak masuk akal', () => {
    // Salah ketik saat menyiapkan pelatihan tidak boleh diam-diam mematikan
    // throttle (NaN) atau membuat pool yang tidak pernah memberi koneksi (0).
    for (const raw of ['abc', '10 orang', '0', '-5', '20.5', 'true', 'NaN', 'Infinity']) {
      expect(positiveIntFromEnv(raw, 10), `masukan ${raw}`).toBe(10);
    }
  });

  it('menerima spasi di sekitar angka, seperti yang sering tertinggal di file .env', () => {
    expect(positiveIntFromEnv(' 25 ', 10)).toBe(25);
  });
});
