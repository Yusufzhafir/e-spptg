/**
 * The kinds of kawasan a pengajuan polygon is checked against — the single
 * source of truth for the `prohibited_area_type` enum, its TypeScript union,
 * the Zod schema, and every dropdown that offers the choice.
 *
 * Order matters: it is the order the options appear in the UI, running from
 * kawasan hutan through the land rights (hak) to the physical setbacks.
 *
 * Deliberately dependency-free. `src/server/db/schema.ts` imports it relatively
 * so drizzle-kit can bundle the schema without resolving path aliases.
 */
export const PROHIBITED_AREA_TYPES = [
  'Kawasan Hutan',
  'Hak Guna Usaha',
  'Hak Guna Bangunan',
  'Hak Pakai',
  'Hak Pengelolaan',
  'Hak Pengelolaan Transmigrasi',
  'Hak Milik',
  'Areal SPPT yang sudah terbit',
  'Kawasan Industri',
  'Tanah Pemerintah',
  'Tanah TNI/Polri',
  'Fasum/Fasos',
  'Sempadan Sungai',
  'Sempadan Pantai',
] as const;

export type ProhibitedAreaType = (typeof PROHIBITED_AREA_TYPES)[number];

/**
 * Names this enum used to carry, mapped to what they are called now.
 *
 * The `prohibited_areas` rows were migrated with the enum, but overlap results
 * are a **JSONB snapshot** written into `submission_drafts.payload` when the
 * check ran — those still hold whatever the jenis was called that day, and no
 * migration reaches inside them. Anything matching a snapshot on jenis has to
 * come through `normalizeProhibitedAreaType` first, or a berkas checked before
 * the rename silently stops matching.
 *
 * Keep in step with the renames in `drizzle-stag/0017_hesitant_shiver_man.sql`.
 */
const LEGACY_TYPE_ALIASES: Record<string, ProhibitedAreaType> = {
  'Hutan Lindung': 'Kawasan Hutan',
  'Aset TNI/POLRI': 'Tanah TNI/Polri',
};

/** The current name for a jenis kawasan, whatever era it was recorded in. */
export function normalizeProhibitedAreaType(value: string): string {
  return LEGACY_TYPE_ALIASES[value] ?? value;
}
