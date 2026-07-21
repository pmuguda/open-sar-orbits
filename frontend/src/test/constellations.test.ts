import { describe, expect, it } from 'vitest';

import { constellationStyle } from '../lib/constellations';

describe('constellation styling (colour-blind-safe)', () => {
  it('gives every known constellation a colour AND a glyph', () => {
    const s1 = constellationStyle('Sentinel-1');
    expect(s1.color).toMatch(/^#/);
    expect(s1.glyph).toBe('S1');
  });

  it('is deterministic for unknown constellations', () => {
    const a = constellationStyle('FUTURE-SAR');
    const b = constellationStyle('FUTURE-SAR');
    expect(a).toEqual(b);
    expect(a.glyph).toBe('FU');
  });

  it('handles missing names', () => {
    expect(constellationStyle(null).glyph).toBe('··');
    expect(constellationStyle(undefined).color).toBeTruthy();
  });
});
