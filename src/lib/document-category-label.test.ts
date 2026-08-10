import { describe, expect, it } from 'vitest';
import { documentCategoryLabel } from './document-category-label';

describe('documentCategoryLabel', () => {
  it('corrects the stored SPPG typo on the way to the screen', () => {
    expect(documentCategoryLabel('SPPG')).toBe('SPPTG');
  });

  it('leaves every other category exactly as stored', () => {
    expect(documentCategoryLabel('KTP')).toBe('KTP');
    expect(documentCategoryLabel('Berita Acara')).toBe('Berita Acara');
    expect(documentCategoryLabel('Lampiran Feedback')).toBe('Lampiran Feedback');
  });

  it('names the certificate from its nomor prefix', () => {
    expect(
      documentCategoryLabel('SPPG', { nomorSPPTG: 'TERDATA/SPPTG/145/KTM/2026' })
    ).toBe('SPPTG Terdata');
    expect(
      documentCategoryLabel('SPPG', { nomorSPPTG: 'TERDAFTAR/SPPTG/145/KTM/2026' })
    ).toBe('SPPTG Terdaftar');
  });

  it('trusts the nomor over the status', () => {
    // A status changed after issuance must not relabel the paper already
    // handed over; the prefix is what that document actually says.
    expect(
      documentCategoryLabel('SPPG', {
        nomorSPPTG: 'TERDATA/SPPTG/145',
        status: 'SPPTG terdaftar',
      })
    ).toBe('SPPTG Terdata');
  });

  it('falls back to the status for records issued before the prefixes', () => {
    expect(
      documentCategoryLabel('SPPG', { nomorSPPTG: '470/123/2026', status: 'SPPTG terdaftar' })
    ).toBe('SPPTG Terdaftar');
  });

  it('stays plain when nothing identifies the variant', () => {
    expect(documentCategoryLabel('SPPG', {})).toBe('SPPTG');
    expect(documentCategoryLabel('SPPG', { nomorSPPTG: '470/123/2026' })).toBe('SPPTG');
    expect(documentCategoryLabel('SPPG', { status: 'SPPTG ditinjau ulang' })).toBe('SPPTG');
  });

  it('survives a payload snapshot holding something that is not a string', () => {
    expect(documentCategoryLabel('SPPG', { nomorSPPTG: 42, status: null })).toBe('SPPTG');
  });
});
