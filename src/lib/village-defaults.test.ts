import { describe, expect, it } from 'vitest';
import { buildVillageDefaultsPatch, type VillageDefaultsSource } from './village-defaults';

/** A desa with every field the wizard reads filled in. */
function completeVillage(): VillageDefaultsSource {
  return {
    namaKepalaDesa: 'Sutrisno',
    juruUkurNama: 'Rina Kartika',
    juruUkurJabatan: 'Juru Ukur',
    juruUkurInstansi: 'Dinas Pertanahan',
    juruUkurNomorHP: '081234567890',
  };
}

describe('buildVillageDefaultsPatch', () => {
  it('fills a draft that captured nothing', () => {
    expect(buildVillageDefaultsPatch({ saksiList: [] } as never, completeVillage())).toEqual({
      namaKepalaDesa: 'Sutrisno',
      juruUkur: {
        nama: 'Rina Kartika',
        jabatan: 'Juru Ukur',
        instansi: 'Dinas Pertanahan',
        nomorHP: '081234567890',
      },
    });
  });

  it('never overwrites the team already recorded on the draft', () => {
    // This is the surveyor printed on the certificate — a later change of post
    // holder must not rewrite who measured this land.
    const draft = {
      juruUkur: { nama: 'Bambang', jabatan: 'Juru Ukur', nomorHP: '081100000000' },
      namaKepalaDesa: 'Kepala Desa Lama',
    };

    expect(buildVillageDefaultsPatch(draft as never, completeVillage())).toEqual({});
  });

  it('fills only the half that is missing', () => {
    const draft = { namaKepalaDesa: 'Kepala Desa Lama' };
    const patch = buildVillageDefaultsPatch(draft as never, completeVillage());

    expect(patch.namaKepalaDesa).toBeUndefined();
    expect(patch.juruUkur?.nama).toBe('Rina Kartika');
  });

  it('skips a half-filled juru ukur rather than building an invalid one', () => {
    // nomorHP is mandatory on ResearchTeamMember; a partial copy would only
    // fail step2LapanganSchema later, further from the cause.
    const village = { ...completeVillage(), juruUkurNomorHP: null };

    expect(buildVillageDefaultsPatch({} as never, village).juruUkur).toBeUndefined();
  });

  it('treats a blank instansi as absent — it is the one optional field', () => {
    const village = { ...completeVillage(), juruUkurInstansi: '' };

    expect(buildVillageDefaultsPatch({} as never, village).juruUkur?.instansi).toBeUndefined();
  });

  it('returns nothing when the desa is unknown or has no settings', () => {
    expect(buildVillageDefaultsPatch({} as never, undefined)).toEqual({});
    expect(buildVillageDefaultsPatch({} as never, {})).toEqual({});
  });
});
