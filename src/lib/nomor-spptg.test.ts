import { describe, expect, it } from 'vitest';
import {
  certificateLabel,
  hasNomorSPPTGBody,
  namaFileSPPTG,
  nomorSPPTGBody,
  nomorSPPTGPrefix,
  NOMOR_SPPTG_PREFIX_TERDAFTAR,
  NOMOR_SPPTG_PREFIX_TERDATA,
  withNomorSPPTGPrefix,
} from './nomor-spptg';

describe('nomorSPPTGPrefix', () => {
  it('follows the Step 3 decision', () => {
    expect(nomorSPPTGPrefix('SPPTG terdata')).toBe(NOMOR_SPPTG_PREFIX_TERDATA);
    expect(nomorSPPTGPrefix('SPPTG terdaftar')).toBe(NOMOR_SPPTG_PREFIX_TERDAFTAR);
  });

  it('defaults to terdaftar when the status is not set yet', () => {
    expect(nomorSPPTGPrefix(undefined)).toBe(NOMOR_SPPTG_PREFIX_TERDAFTAR);
  });
});

describe('nomorSPPTGBody', () => {
  it('strips either prefix so only the typed part reaches the input', () => {
    expect(nomorSPPTGBody('TERDAFTAR/SPPTG/145/KTM/2026')).toBe('145/KTM/2026');
    expect(nomorSPPTGBody('TERDATA/SPPTG/145/KTM/2026')).toBe('145/KTM/2026');
  });

  it('keeps a pre-prefix number whole — it becomes the body', () => {
    expect(nomorSPPTGBody('470/123/2025')).toBe('470/123/2025');
  });

  it('treats an unset or prefix-only value as empty', () => {
    expect(nomorSPPTGBody(undefined)).toBe('');
    expect(nomorSPPTGBody(null)).toBe('');
    expect(nomorSPPTGBody('TERDAFTAR/SPPTG/')).toBe('');
    expect(nomorSPPTGBody('TERDATA/SPPTG/')).toBe('');
  });
});

describe('withNomorSPPTGPrefix', () => {
  it('joins the prefix its status calls for', () => {
    expect(withNomorSPPTGPrefix('145/KTM/2026', 'SPPTG terdaftar')).toBe(
      'TERDAFTAR/SPPTG/145/KTM/2026'
    );
    expect(withNomorSPPTGPrefix('145/KTM/2026', 'SPPTG terdata')).toBe(
      'TERDATA/SPPTG/145/KTM/2026'
    );
  });

  it('re-prefixes when the decision changes, keeping the number', () => {
    // Step 3 can be revisited; the nomor must follow the new decision rather
    // than end up with the old prefix buried inside it.
    const terdaftar = withNomorSPPTGPrefix('145/KTM/2026', 'SPPTG terdaftar');
    expect(withNomorSPPTGPrefix(nomorSPPTGBody(terdaftar), 'SPPTG terdata')).toBe(
      'TERDATA/SPPTG/145/KTM/2026'
    );
  });

  it('never doubles the prefix when a full number is pasted in', () => {
    expect(withNomorSPPTGPrefix('TERDAFTAR/SPPTG/145', 'SPPTG terdaftar')).toBe(
      'TERDAFTAR/SPPTG/145'
    );
    expect(withNomorSPPTGPrefix('terdata/spptg/145', 'SPPTG terdata')).toBe(
      'TERDATA/SPPTG/145'
    );
  });

  it('absorbs a lead the prefix already covers', () => {
    expect(withNomorSPPTGPrefix('SPPTG/XX/123/2025', 'SPPTG terdaftar')).toBe(
      'TERDAFTAR/SPPTG/XX/123/2025'
    );
    expect(withNomorSPPTGPrefix('/145/KTM/2026', 'SPPTG terdaftar')).toBe(
      'TERDAFTAR/SPPTG/145/KTM/2026'
    );
  });

  it('leaves the bare prefix when nothing has been typed yet', () => {
    expect(withNomorSPPTGPrefix('', 'SPPTG terdata')).toBe(NOMOR_SPPTG_PREFIX_TERDATA);
  });

  it('is stable — normalising an already-normal value changes nothing', () => {
    // The Step 4 effect re-runs this on every render; a value that keeps
    // growing would loop forever.
    const once = withNomorSPPTGPrefix('145/KTM/2026', 'SPPTG terdata');
    expect(withNomorSPPTGPrefix(nomorSPPTGBody(once), 'SPPTG terdata')).toBe(once);
  });
});

describe('hasNomorSPPTGBody', () => {
  it('rejects a bare prefix — that is not a certificate number', () => {
    expect(hasNomorSPPTGBody('TERDAFTAR/SPPTG/')).toBe(false);
    expect(hasNomorSPPTGBody('TERDATA/SPPTG/')).toBe(false);
    expect(hasNomorSPPTGBody('')).toBe(false);
    expect(hasNomorSPPTGBody(undefined)).toBe(false);
  });

  it('accepts a prefix with a real number behind it', () => {
    expect(hasNomorSPPTGBody('TERDATA/SPPTG/145/KTM/2026')).toBe(true);
  });
});

describe('namaFileSPPTG', () => {
  it('states the decision once — the stored nomor already carries it', () => {
    expect(namaFileSPPTG('TERDATA/SPPTG/145/KTM/2026', 'SPPTG terdata')).toBe(
      'SPPTG_TERDATA_145_KTM_2026'
    );
    expect(namaFileSPPTG('TERDAFTAR/SPPTG/145/KTM/2026', 'SPPTG terdaftar')).toBe(
      'SPPTG_TERDAFTAR_145_KTM_2026'
    );
  });

  it('names a pre-prefix number after its decision all the same', () => {
    expect(namaFileSPPTG('470/123/2025', 'SPPTG terdata')).toBe('SPPTG_TERDATA_470_123_2025');
  });

  it('falls back rather than ending on a bare lead', () => {
    expect(namaFileSPPTG('TERDATA/SPPTG/', 'SPPTG terdata')).toBe('SPPTG_TERDATA_dokumen');
    expect(namaFileSPPTG(undefined, 'SPPTG terdaftar')).toBe('SPPTG_TERDAFTAR_dokumen');
  });

  it('leaves no separator that a filesystem would read as a path', () => {
    expect(namaFileSPPTG('TERDATA/SPPTG/145 \\ KTM', 'SPPTG terdata')).not.toMatch(/[\\/]/);
  });
});

describe('certificateLabel', () => {
  it('names each certificate after the decision that produced it', () => {
    expect(certificateLabel('SPPTG terdaftar')).toBe('SPPTG Terdaftar');
    expect(certificateLabel('SPPTG terdata')).toBe('SPPTG Terdata');
  });

  it('stays neutral before a decision exists', () => {
    // Step 4 is still named in the stepper then; naming a certificate that
    // cannot be issued yet would be a guess.
    expect(certificateLabel(undefined)).toBe('SPPTG');
    expect(certificateLabel('SPPTG ditolak')).toBe('SPPTG');
  });

  it('agrees with the nomor prefix for every decision that can issue', () => {
    // The two switch on the same status; a label and a prefix that disagree
    // would be worse than either mistake alone.
    for (const status of ['SPPTG terdaftar', 'SPPTG terdata']) {
      const prefixWord = nomorSPPTGPrefix(status).split('/')[0];
      expect(certificateLabel(status).toUpperCase()).toContain(prefixWord);
    }
  });
});
