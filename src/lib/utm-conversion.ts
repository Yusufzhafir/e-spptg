import proj4 from 'proj4';

export interface UTMNumericCoordinate {
  zone: number;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
}

export interface UTMStringInput {
  zone: string;
  hemisphere: 'N' | 'S';
  easting: string;
  northing: string;
}

function getUtmProjection(zone: number, hemisphere: 'N' | 'S'): string {
  return `+proj=utm +zone=${zone} +${hemisphere === 'S' ? 'south' : 'north'} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
}

export function toUtmFromLatLon(lat: number, lon: number): UTMNumericCoordinate {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'N' : 'S';
  const [easting, northing] = proj4('EPSG:4326', getUtmProjection(zone, hemisphere), [lon, lat]);

  return {
    zone,
    hemisphere,
    easting: Number(easting.toFixed(2)),
    northing: Number(northing.toFixed(2)),
  };
}

export function toLatLonFromUtm(
  utm: UTMNumericCoordinate
): { latitude: number; longitude: number } | null {
  const { zone, hemisphere, easting, northing } = utm;

  try {
    const [longitude, latitude] = proj4(getUtmProjection(zone, hemisphere), 'EPSG:4326', [
      easting,
      northing,
    ]);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  } catch {
    return null;
  }
}

export function parseUtmInputStrings(input: UTMStringInput): UTMNumericCoordinate | null {
  const zone = Number.parseInt(input.zone.trim(), 10);
  const easting = Number.parseFloat(input.easting.trim());
  const northing = Number.parseFloat(input.northing.trim());

  if (!Number.isInteger(zone) || zone < 1 || zone > 60) {
    return null;
  }

  if (input.hemisphere !== 'N' && input.hemisphere !== 'S') {
    return null;
  }

  if (!Number.isFinite(easting) || !Number.isFinite(northing)) {
    return null;
  }

  return {
    zone,
    hemisphere: input.hemisphere,
    easting,
    northing,
  };
}
