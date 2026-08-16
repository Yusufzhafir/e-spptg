import type { GeographicCoordinate } from '@/types';

export type CoordinateWithOptionalId = Omit<GeographicCoordinate, 'id'> & {
  id?: string | null;
};

function sanitizeId(rawId: string | null | undefined): string | null {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function coordinatesNeedIdNormalization(
  coordinates: CoordinateWithOptionalId[]
): boolean {
  const seen = new Set<string>();

  for (const coordinate of coordinates) {
    const id = sanitizeId(coordinate.id);
    if (!id) return true;
    // An id that only differs by surrounding whitespace still gets rewritten,
    // so it counts as needing normalization — otherwise this would disagree
    // with what `normalizeCoordinateIds` actually produces.
    if (id !== coordinate.id) return true;
    if (seen.has(id)) return true;
    seen.add(id);
  }

  return false;
}

export function normalizeCoordinateIds(
  coordinates: CoordinateWithOptionalId[],
  fallbackPrefix = 'C'
): GeographicCoordinate[] {
  /**
   * Nothing to fix — hand back the very same array.
   *
   * This runs through `polygonsPatch` on **every keystroke** in Step 2, and the
   * array's identity is load-bearing downstream: a fresh one re-syncs Terra Draw
   * and makes the map tear down and rebuild every reference polygon it holds
   * (hundreds of kawasan and SPPTG). Typing a nomor persil must not cost that.
   */
  if (!coordinatesNeedIdNormalization(coordinates)) {
    return coordinates as GeographicCoordinate[];
  }

  const seen = new Set<string>();

  return coordinates.map((coordinate, index) => {
    const baseId = sanitizeId(coordinate.id) ?? `${fallbackPrefix}-${index + 1}`;

    let nextId = baseId;
    let suffix = 2;
    while (seen.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    seen.add(nextId);

    return {
      id: nextId,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  });
}
