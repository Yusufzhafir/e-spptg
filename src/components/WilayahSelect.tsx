'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect, SearchableSelectOption } from './SearchableSelect';
import { Label } from './ui/label';
import { RequiredMark } from './RequiredMark';
import { FieldError } from './FieldError';

type Region = { id: string; name: string };

const BASE = 'https://www.emsifa.com/api-wilayah-indonesia/api';

async function fetchRegions(url: string): Promise<Region[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal memuat data wilayah');
  return (await res.json()) as Region[];
}

/** Build select options, injecting the stored value if it isn't in the fetched
 *  list yet (e.g. legacy data whose casing differs from the API). */
function toOptions(regions: Region[] | undefined, current?: string): SearchableSelectOption[] {
  const opts: SearchableSelectOption[] = (regions ?? []).map((r) => ({
    value: r.name,
    label: r.name,
  }));
  if (current && !opts.some((o) => o.value.toLowerCase() === current.toLowerCase())) {
    opts.unshift({ value: current, label: current });
  }
  return opts;
}

function findIdByName(regions: Region[] | undefined, name?: string): string | undefined {
  if (!regions || !name) return undefined;
  const target = name.trim().toLowerCase();
  return regions.find((r) => r.name.trim().toLowerCase() === target)?.id;
}

export interface WilayahValue {
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
}

interface WilayahSelectProps {
  value: WilayahValue;
  onChange: (patch: WilayahValue) => void;
  errors?: WilayahValue;
  idPrefix?: string;
}

/**
 * Cascading Provinsi → Kabupaten/Kota → Kecamatan searchable selects.
 * Region data is fetched at runtime from the public api-wilayah-indonesia
 * (Kemendagri/BPS) dataset. Values are stored as names to match the villages
 * schema; the child lists are driven by ids derived from the selected names.
 */
export function WilayahSelect({ value, onChange, errors = {}, idPrefix = '' }: WilayahSelectProps) {
  const provincesQuery = useQuery({
    queryKey: ['wilayah', 'provinces'],
    queryFn: () => fetchRegions(`${BASE}/provinces.json`),
    staleTime: Infinity,
  });

  const provinceId = useMemo(
    () => findIdByName(provincesQuery.data, value.provinsi),
    [provincesQuery.data, value.provinsi]
  );

  const regenciesQuery = useQuery({
    queryKey: ['wilayah', 'regencies', provinceId],
    queryFn: () => fetchRegions(`${BASE}/regencies/${provinceId}.json`),
    enabled: Boolean(provinceId),
    staleTime: Infinity,
  });

  const regencyId = useMemo(
    () => findIdByName(regenciesQuery.data, value.kabupaten),
    [regenciesQuery.data, value.kabupaten]
  );

  const districtsQuery = useQuery({
    queryKey: ['wilayah', 'districts', regencyId],
    queryFn: () => fetchRegions(`${BASE}/districts/${regencyId}.json`),
    enabled: Boolean(regencyId),
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () => toOptions(provincesQuery.data, value.provinsi),
    [provincesQuery.data, value.provinsi]
  );
  const regencyOptions = useMemo(
    () => toOptions(regenciesQuery.data, value.kabupaten),
    [regenciesQuery.data, value.kabupaten]
  );
  const districtOptions = useMemo(
    () => toOptions(districtsQuery.data, value.kecamatan),
    [districtsQuery.data, value.kecamatan]
  );

  const errClass = (field: keyof WilayahValue) =>
    errors[field] ? 'border-red-500' : undefined;

  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}provinsi`}>Provinsi<RequiredMark /></Label>
        <SearchableSelect
          id={`${idPrefix}provinsi`}
          value={value.provinsi ?? ''}
          onValueChange={(name) => onChange({ provinsi: name, kabupaten: '', kecamatan: '' })}
          placeholder={provincesQuery.isLoading ? 'Memuat provinsi...' : 'Pilih provinsi'}
          searchPlaceholder="Cari provinsi..."
          emptyText={provincesQuery.isError ? 'Gagal memuat data' : 'Tidak ditemukan.'}
          className={errClass('provinsi')}
          options={provinceOptions}
        />
        <FieldError message={errors.provinsi} />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}kabupaten`}>Kabupaten/Kota<RequiredMark /></Label>
        <SearchableSelect
          id={`${idPrefix}kabupaten`}
          value={value.kabupaten ?? ''}
          onValueChange={(name) => onChange({ kabupaten: name, kecamatan: '' })}
          placeholder={
            !value.provinsi
              ? 'Pilih provinsi dahulu'
              : regenciesQuery.isLoading
                ? 'Memuat kabupaten/kota...'
                : 'Pilih kabupaten/kota'
          }
          searchPlaceholder="Cari kabupaten/kota..."
          emptyText={regenciesQuery.isError ? 'Gagal memuat data' : 'Tidak ditemukan.'}
          disabled={!value.provinsi}
          className={errClass('kabupaten')}
          options={regencyOptions}
        />
        <FieldError message={errors.kabupaten} />
      </div>

      <div>
        <Label htmlFor={`${idPrefix}kecamatan`}>Kecamatan<RequiredMark /></Label>
        <SearchableSelect
          id={`${idPrefix}kecamatan`}
          value={value.kecamatan ?? ''}
          onValueChange={(name) => onChange({ kecamatan: name })}
          placeholder={
            !value.kabupaten
              ? 'Pilih kabupaten/kota dahulu'
              : districtsQuery.isLoading
                ? 'Memuat kecamatan...'
                : 'Pilih kecamatan'
          }
          searchPlaceholder="Cari kecamatan..."
          emptyText={districtsQuery.isError ? 'Gagal memuat data' : 'Tidak ditemukan.'}
          disabled={!value.kabupaten}
          className={errClass('kecamatan')}
          options={districtOptions}
        />
        <FieldError message={errors.kecamatan} />
      </div>
    </>
  );
}
