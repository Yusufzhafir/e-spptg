import { ProhibitedArea } from ".";

/**
 * Input type for creating a prohibited area via API
 * Matches createProhibitedAreaSchema validation schema exactly
 */
export type CreateProhibitedAreaInput = {
  namaKawasan: string;
  jenisKawasan: ProhibitedArea['jenisKawasan'];
  sumberData: string;
  dasarHukum?: string; // optional() = string | undefined
  tanggalEfektif: Date; // z.coerce.date()
  diunggahOleh?: number; // optional, backend uses ctx.appUser.id
  statusValidasi?: 'Lolos' | 'Perlu Perbaikan';
  aktifDiValidasi?: boolean;
  warna: string;
  catatan: string | null; // nullable() = string | null
  geomGeoJSON: {
    type: 'Polygon';
    coordinates: [[[number, number]]];
  };
};

/**
 * Input type for updating a prohibited area via API
 * All fields are optional (Partial)
 */
export type UpdateProhibitedAreaInput = Partial<CreateProhibitedAreaInput>;