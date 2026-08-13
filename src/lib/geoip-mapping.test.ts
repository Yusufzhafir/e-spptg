import { ipBisaDilacak, petakanLokasi, LOKASI_KOSONG } from './geoip-mapping';

describe('ipBisaDilacak', () => {
  it('menerima alamat publik', () => {
    expect(ipBisaDilacak('114.10.139.155')).toBe(true);
    expect(ipBisaDilacak('103.222.254.244')).toBe(true);
    expect(ipBisaDilacak('2404:6800:4003::1')).toBe(true);
  });

  it('menolak alamat yang tidak akan pernah ada di basis data', () => {
    expect(ipBisaDilacak(null)).toBe(false);
    expect(ipBisaDilacak('')).toBe(false);
    expect(ipBisaDilacak('   ')).toBe(false);
    expect(ipBisaDilacak('127.0.0.1')).toBe(false);
    expect(ipBisaDilacak('::1')).toBe(false);
    expect(ipBisaDilacak('10.4.1.9')).toBe(false);
    expect(ipBisaDilacak('192.168.1.5')).toBe(false);
    expect(ipBisaDilacak('fe80::1')).toBe(false);
  });

  it('membedakan 172.16/12 yang privat dari 172.x lain yang publik', () => {
    // Jaringan Docker di host ini memakai 172.18.0.1 — harus ditolak.
    expect(ipBisaDilacak('172.18.0.1')).toBe(false);
    expect(ipBisaDilacak('172.16.0.1')).toBe(false);
    expect(ipBisaDilacak('172.31.255.254')).toBe(false);
    // Di luar rentang itu 172.x adalah alamat publik biasa.
    expect(ipBisaDilacak('172.15.0.1')).toBe(true);
    expect(ipBisaDilacak('172.32.0.1')).toBe(true);
    expect(ipBisaDilacak('172.217.194.100')).toBe(true);
  });
});

describe('petakanLokasi', () => {
  it('mengambil kode negara dan nama kota', () => {
    expect(
      petakanLokasi({
        country: { iso_code: 'ID' },
        city: { names: { en: 'Sangatta' } },
        subdivisions: [{ names: { en: 'East Kalimantan' } }],
      })
    ).toEqual({ negara: 'ID', kota: 'Sangatta' });
  });

  it('memakai provinsi kalau kota tidak dikenal', () => {
    expect(
      petakanLokasi({
        country: { iso_code: 'ID' },
        subdivisions: [{ names: { en: 'East Kalimantan' } }],
      })
    ).toEqual({ negara: 'ID', kota: 'East Kalimantan' });
  });

  it('mengembalikan kosong untuk hasil yang tidak ada', () => {
    expect(petakanLokasi(null)).toEqual(LOKASI_KOSONG);
    expect(petakanLokasi(undefined)).toEqual(LOKASI_KOSONG);
    expect(petakanLokasi({})).toEqual({ negara: null, kota: null });
  });

  it('tidak menyimpan string kosong sebagai lokasi', () => {
    expect(petakanLokasi({ country: { iso_code: '  ' }, city: { names: { en: '' } } })).toEqual({
      negara: null,
      kota: null,
    });
  });

  it('memotong nilai yang melebihi lebar kolom', () => {
    const panjang = 'K'.repeat(200);
    const hasil = petakanLokasi({ city: { names: { en: panjang } } });
    expect(hasil.kota).toHaveLength(120);
  });
});
