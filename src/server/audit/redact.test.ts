import { describe, expect, it } from 'vitest';
import { REDACTED, diffFields, redact } from './redact';

describe('redact — menyensor rahasia', () => {
  it('menyensor kata sandi, hash, token, dan secret apa pun', () => {
    const out = redact({
      email: 'budi@gmail.com',
      password: 'RahasiaBanget123',
      passwordHash: 'scrypt$16384$8$1$c2FsdA==$aGFzaA==',
      newPassword: 'Baru123',
      kataSandi: 'x',
      token: 'abc',
      apiKey: 'k',
      API_KEY: 'k',
      refreshToken: 'r',
    }) as Record<string, unknown>;

    expect(out.email, 'email bukan rahasia dan berguna di jejak audit').toBe(
      'budi@gmail.com'
    );
    for (const field of [
      'password',
      'passwordHash',
      'newPassword',
      'kataSandi',
      'token',
      'apiKey',
      'API_KEY',
      'refreshToken',
    ]) {
      expect(out[field], `${field} tidak disensor`).toBe(REDACTED);
    }
  });

  it('menyensor sampai ke dalam objek bersarang', () => {
    const out = redact({
      data: { user: { nama: 'Budi', password: 'rahasia' } },
    }) as Record<string, Record<string, Record<string, unknown>>>;

    expect(out.data.user.nama).toBe('Budi');
    expect(out.data.user.password).toBe(REDACTED);
  });

  it('memotong string raksasa agar satu baris audit tidak jadi megabyte', () => {
    const out = redact({ kml: 'x'.repeat(5000) }) as Record<string, string>;
    expect(out.kml.length).toBeLessThan(600);
    expect(out.kml).toContain('5000 karakter');
  });

  it('memotong array panjang', () => {
    const out = redact({ koordinat: Array.from({ length: 200 }, (_, i) => i) }) as {
      koordinat: unknown[];
    };
    expect(out.koordinat.length).toBe(51);
    expect(out.koordinat[50]).toContain('150 item lainnya');
  });

  it('mengubah Date jadi ISO dan membiarkan tipe primitif', () => {
    const out = redact({
      tanggal: new Date('2026-01-15T03:04:05.000Z'),
      jumlah: 42,
      aktif: true,
      kosong: null,
    }) as Record<string, unknown>;

    expect(out.tanggal).toBe('2026-01-15T03:04:05.000Z');
    expect(out.jumlah).toBe(42);
    expect(out.aktif).toBe(true);
    expect(out.kosong).toBeNull();
  });

  it('tidak macet pada struktur melingkar', () => {
    const a: Record<string, unknown> = { nama: 'a' };
    a.diri = a;
    expect(() => redact(a)).not.toThrow();
  });
});

describe('diffFields — perubahan sebelum/sesudah', () => {
  it('hanya melaporkan kolom yang benar-benar berubah', () => {
    const changed = diffFields(
      { nama: 'Budi', peran: 'Viewer', email: 'b@x.id' },
      { nama: 'Budi', peran: 'Admin', email: 'b@x.id' }
    );

    expect(Object.keys(changed)).toEqual(['peran']);
    expect(changed.peran).toEqual({ sebelum: 'Viewer', sesudah: 'Admin' });
  });

  it('menangkap kolom yang muncul atau hilang', () => {
    const changed = diffFields({ a: 1 }, { b: 2 });
    expect(changed.a).toEqual({ sebelum: 1, sesudah: null });
    expect(changed.b).toEqual({ sebelum: null, sesudah: 2 });
  });

  it('tidak menganggap objek bersarang yang setara sebagai perubahan', () => {
    const changed = diffFields(
      { meta: { a: 1, b: [1, 2] } },
      { meta: { a: 1, b: [1, 2] } }
    );
    expect(changed).toEqual({});
  });

  it('mengembalikan objek kosong kalau salah satu sisi bukan objek', () => {
    expect(diffFields(null, { a: 1 })).toEqual({});
    expect(diffFields({ a: 1 }, null)).toEqual({});
    expect(diffFields([1], [2])).toEqual({});
  });
});
