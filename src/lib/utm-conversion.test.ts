import { describe, expect, it } from 'vitest';
import {
  parseUtmInputStrings,
  toLatLonFromUtm,
  toUtmFromLatLon,
} from './utm-conversion';

describe('utm-conversion', () => {
  it('demonstrates round-trip drift from transient easting edits due to auto-zone derivation', () => {
    const fromTransient = toLatLonFromUtm({
      zone: 48,
      hemisphere: 'S',
      easting: 6,
      northing: 9_300_000,
    });

    expect(fromTransient).not.toBeNull();
    const roundTrip = toUtmFromLatLon(fromTransient!.latitude, fromTransient!.longitude);

    expect(roundTrip.zone).not.toBe(48);
    expect(Math.abs(roundTrip.easting - 6)).toBeGreaterThan(100_000);
  });

  it('does not coerce empty or intermediate strings into numeric values', () => {
    expect(
      parseUtmInputStrings({
        zone: '',
        hemisphere: 'S',
        easting: '500000',
        northing: '9300000',
      })
    ).toBeNull();

    expect(
      parseUtmInputStrings({
        zone: '48',
        hemisphere: 'S',
        easting: '',
        northing: '9300000',
      })
    ).toBeNull();

    expect(
      parseUtmInputStrings({
        zone: '48',
        hemisphere: 'S',
        easting: '-',
        northing: '9300000',
      })
    ).toBeNull();
  });

  it('parses valid strings and produces finite lat/lon values', () => {
    const parsed = parseUtmInputStrings({
      zone: '48',
      hemisphere: 'S',
      easting: '500000.12',
      northing: '9300000.56',
    });

    expect(parsed).not.toBeNull();

    const latLon = toLatLonFromUtm(parsed!);
    expect(latLon).not.toBeNull();
    expect(Number.isFinite(latLon!.latitude)).toBe(true);
    expect(Number.isFinite(latLon!.longitude)).toBe(true);
  });
});
