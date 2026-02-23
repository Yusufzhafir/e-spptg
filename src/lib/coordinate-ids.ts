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
    if (seen.has(id)) return true;
    seen.add(id);
  }

  return false;
}

export function normalizeCoordinateIds(
  coordinates: CoordinateWithOptionalId[],
  fallbackPrefix = 'C'
): GeographicCoordinate[] {
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
