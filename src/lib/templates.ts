export const ALLOWED_TEMPLATES = [
  'surat_pernyataan_permohonan.pdf',
  'surat_pernyataan_tidak_sengketa.pdf',
  'berita_acara_validasi_lapangan.pdf',
] as const;

export type TemplateType = (typeof ALLOWED_TEMPLATES)[number];

export const TEMPLATE_FILENAME_MAP: Record<TemplateType, string> = {
  surat_pernyataan_permohonan: 'Surat Pernyataan Permohonan.pdf',
  surat_pernyataan_tidak_sengketa: 'Surat Pernyataan Tidak Sengketa.pdf',
  berita_acara_validasi_lapangan: 'Berita Acara Validasi Lapangan.pdf',
};
