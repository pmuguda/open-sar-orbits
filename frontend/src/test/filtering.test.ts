import { describe, expect, it } from 'vitest';

import { distinctValues, EMPTY_FILTERS, filterSatellites } from '../lib/filtering';
import { MERGED_SATELLITES } from './fixtures';

describe('satellite filtering', () => {
  it('passes everything with empty filters', () => {
    expect(filterSatellites(MERGED_SATELLITES, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('searches name, mission and constellation, case-insensitively', () => {
    expect(filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, q: 'sentinel' })).toHaveLength(
      1,
    );
    expect(filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, q: 'copernicus' })).toHaveLength(
      1,
    );
    expect(filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, q: 'zzz' })).toHaveLength(0);
  });

  it('filters by band, status and open data', () => {
    expect(filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, band: 'X' })).toHaveLength(1);
    expect(
      filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, status: 'active' }),
    ).toHaveLength(2);
    expect(filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, openData: 'yes' })).toHaveLength(
      1,
    );
  });

  it('drops registry-less satellites when a registry filter is set', () => {
    const result = filterSatellites(MERGED_SATELLITES, { ...EMPTY_FILTERS, country: 'Germany' });
    expect(result.map((s) => s.norad_catalog_id)).toEqual([31698]);
  });

  it('lists distinct sorted dropdown values', () => {
    expect(distinctValues(MERGED_SATELLITES, 'frequency_band')).toEqual(['C', 'X']);
    expect(distinctValues(MERGED_SATELLITES, 'constellation')).toEqual([
      'Sentinel-1',
      'TerraSAR-X',
    ]);
  });
});
