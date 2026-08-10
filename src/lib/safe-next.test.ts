import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('meloloskan path absolut satu origin', () => {
    expect(safeNextPath('/app')).toBe('/app');
    expect(safeNextPath('/app/pengajuan/12?tab=peta')).toBe('/app/pengajuan/12?tab=peta');
  });

  it('kembali ke /app saat kosong', () => {
    expect(safeNextPath(null)).toBe('/app');
    expect(safeNextPath(undefined)).toBe('/app');
    expect(safeNextPath('')).toBe('/app');
  });

  it('menolak URL lengkap — ini yang mencegah open redirect', () => {
    // Tautan phishing di domain go.id: korban melihat halaman masuk yang asli,
    // lalu dilempar ke situs penyerang setelah berhasil masuk.
    expect(safeNextPath('https://jahat.example/panen')).toBe('/app');
    expect(safeNextPath('http://jahat.example')).toBe('/app');
  });

  it('menolak bentuk protocol-relative', () => {
    // '//jahat.example' terlihat seperti path, tetapi peramban membacanya
    // sebagai host lain.
    expect(safeNextPath('//jahat.example')).toBe('/app');
    expect(safeNextPath('//jahat.example/app')).toBe('/app');
  });

  it('menolak path relatif dan skema aneh', () => {
    expect(safeNextPath('app/pengajuan')).toBe('/app');
    expect(safeNextPath('javascript:alert(1)')).toBe('/app');
  });

  it('menghormati fallback lain kalau diminta', () => {
    expect(safeNextPath(null, '/')).toBe('/');
  });
});
