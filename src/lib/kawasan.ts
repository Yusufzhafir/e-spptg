/**
 * Kawasan Non-SPPTG are always rendered in a single red so they read as
 * "prohibited" consistently across every map and legend. The per-area `warna`
 * column is no longer user-editable; new records are stored with this value and
 * all map rendering uses it directly instead of the stored value.
 */
export const KAWASAN_NON_SPPTG_COLOR = '#ef4444';
