/**
 * Most document categories hold exactly one file — replacing a KTP or a feedback
 * attachment should not leave the previous one on screen. Older rows (and any
 * upload whose cleanup failed) can still carry duplicates, so the detail page
 * shows only the newest per single-file category.
 *
 * 'Foto Lahan' is the one category that legitimately holds several files.
 */
const MULTI_FILE_CATEGORIES = new Set(['Foto Lahan']);

type DocumentLike = {
  id: number;
  category: string;
  uploadedAt: Date | string;
};

function uploadedAtMs(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  // An unparseable timestamp must lose to a real one rather than win by NaN.
  return Number.isNaN(time) ? -Infinity : time;
}

/**
 * Drop superseded files, keeping the newest of each single-file category.
 * Input order is preserved so the caller's sorting still applies.
 */
export function keepLatestPerCategory<T extends DocumentLike>(documents: T[]): T[] {
  const keptIdByCategory = new Map<string, T>();

  for (const doc of documents) {
    if (MULTI_FILE_CATEGORIES.has(doc.category)) continue;

    const current = keptIdByCategory.get(doc.category);
    if (!current) {
      keptIdByCategory.set(doc.category, doc);
      continue;
    }

    const docTime = uploadedAtMs(doc.uploadedAt);
    const currentTime = uploadedAtMs(current.uploadedAt);
    // Equal timestamps happen when several files land in the same second; the
    // higher id is the later insert.
    if (docTime > currentTime || (docTime === currentTime && doc.id > current.id)) {
      keptIdByCategory.set(doc.category, doc);
    }
  }

  const keptIds = new Set([...keptIdByCategory.values()].map((doc) => doc.id));

  return documents.filter(
    (doc) => MULTI_FILE_CATEGORIES.has(doc.category) || keptIds.has(doc.id)
  );
}
