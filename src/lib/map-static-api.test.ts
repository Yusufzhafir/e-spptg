import { beforeEach, describe, expect, it } from 'vitest';
import {
  generateStaticMapUrl,
  generateStaticMapUrlForPolygons,
} from '@/lib/map-static-api';

describe('generateStaticMapUrl', () => {
  it('builds a contextual roadmap URL with encoded polygon path', () => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';

    const url = generateStaticMapUrl([
      { id: '1', latitude: -6.2, longitude: 106.8 },
      { id: '2', latitude: -6.201, longitude: 106.802 },
      { id: '3', latitude: -6.202, longitude: 106.801 },
    ]);

    expect(url).toBeTruthy();
    expect(url).toContain('maps.googleapis.com/maps/api/staticmap');
    expect(url).toContain('maptype=roadmap');
    expect(url).toContain('scale=2');
    expect(url).toContain('enc%3A');
  });
});


describe('generateStaticMapUrlForPolygons', () => {
  const bidangA = [
    { id: '1', latitude: -6.2, longitude: 106.8 },
    { id: '2', latitude: -6.201, longitude: 106.802 },
    { id: '3', latitude: -6.202, longitude: 106.801 },
  ];
  const bidangB = [
    { id: '4', latitude: -6.4, longitude: 107.0 },
    { id: '5', latitude: -6.401, longitude: 107.002 },
    { id: '6', latitude: -6.402, longitude: 107.001 },
  ];

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';
  });

  it('emits one path per bidang so no parcel is left off the map', () => {
    const url = generateStaticMapUrlForPolygons([bidangA, bidangB])!;
    const paths = url.split('&').filter((part) => part.startsWith('path='));

    expect(paths).toHaveLength(2);
  });

  it('centres between the bidang rather than on one of them', () => {
    const url = new URL(generateStaticMapUrlForPolygons([bidangA, bidangB])!);
    const [lat, lng] = url.searchParams.get('center')!.split(',').map(Number);

    expect(lat).toBeLessThan(-6.2);
    expect(lat).toBeGreaterThan(-6.402);
    expect(lng).toBeGreaterThan(106.8);
    expect(lng).toBeLessThan(107.002);
  });

  it('matches the single-polygon builder for one bidang', () => {
    expect(generateStaticMapUrlForPolygons([bidangA])).toBe(
      generateStaticMapUrl(bidangA)
    );
  });

  it('ignores rings too short to be a polygon, and returns null when none are left', () => {
    expect(generateStaticMapUrlForPolygons([bidangA.slice(0, 2)])).toBeNull();
    expect(generateStaticMapUrlForPolygons([])).toBeNull();

    const url = generateStaticMapUrlForPolygons([bidangA.slice(0, 2), bidangB])!;
    expect(url.split('&').filter((part) => part.startsWith('path='))).toHaveLength(1);
  });
});
