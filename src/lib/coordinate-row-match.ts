export interface CoordinateRowLike {
  id?: string;
}

function sanitizeId(id: string | undefined): string | undefined {
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function hasUniqueCoordinateId(
  rows: CoordinateRowLike[],
  targetId: string | undefined
): boolean {
  const normalizedTargetId = sanitizeId(targetId);
  if (!normalizedTargetId) return false;

  let matchCount = 0;
  for (const row of rows) {
    if (sanitizeId(row.id) !== normalizedTargetId) continue;

    matchCount += 1;
    if (matchCount > 1) {
      return false;
    }
  }

  return matchCount === 1;
}

export function createCoordinateRowMatcher<Row extends CoordinateRowLike>(
  rows: Row[],
  targetId: string | undefined,
  targetIndex: number
): (row: Row, rowIndex: number) => boolean {
  const normalizedTargetId = sanitizeId(targetId);
  const useId = hasUniqueCoordinateId(rows, normalizedTargetId);

  return (row: Row, rowIndex: number) => {
    if (useId && normalizedTargetId) {
      return sanitizeId(row.id) === normalizedTargetId;
    }

    return rowIndex === targetIndex;
  };
}
