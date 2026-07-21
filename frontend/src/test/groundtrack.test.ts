import { describe, expect, it } from 'vitest';

import { splitTrackSegments } from '../lib/groundtrack';

describe('ground-track segmentation', () => {
  it('keeps a continuous track as one segment', () => {
    const samples = [
      { lonDeg: 10, latDeg: 0 },
      { lonDeg: 11, latDeg: 5 },
      { lonDeg: 12, latDeg: 10 },
    ];
    const segments = splitTrackSegments(samples);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual([10, 0, 11, 5, 12, 10]);
  });

  it('splits at the antimeridian crossing', () => {
    const samples = [
      { lonDeg: 176, latDeg: 0 },
      { lonDeg: 179, latDeg: 2 },
      { lonDeg: -179, latDeg: 4 }, // wrapped
      { lonDeg: -176, latDeg: 6 },
    ];
    const segments = splitTrackSegments(samples);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual([176, 0, 179, 2]);
    expect(segments[1]).toEqual([-179, 4, -176, 6]);
  });

  it('drops one-point fragments', () => {
    const samples = [
      { lonDeg: 179, latDeg: 0 },
      { lonDeg: -179, latDeg: 1 },
    ];
    expect(splitTrackSegments(samples)).toHaveLength(0);
  });
});
