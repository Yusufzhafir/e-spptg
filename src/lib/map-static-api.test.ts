import { describe, expect, it } from 'vitest';
import { generateStaticMapUrl } from '@/lib/map-static-api';

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

