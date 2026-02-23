export const ALLOWED_TEMPLATES = [
  'surat_pernyataan_permohonan.pdf',
  'surat_pernyataan_tidak_sengketa.docx',
  'berita_acara_validasi_lapangan.docx',
] as const;

export type TemplateType = (typeof ALLOWED_TEMPLATES)[number];

export const TEMPLATE_FILENAME_MAP: Record<TemplateType, string> = {
  'surat_pernyataan_permohonan.pdf': 'Surat Pernyataan Permohonan.pdf',
  "surat_pernyataan_tidak_sengketa.docx": 'Surat Pernyataan Tidak Sengketa.docx',
  "berita_acara_validasi_lapangan.docx": 'Berita Acara Validasi Lapangan.docx',
};
