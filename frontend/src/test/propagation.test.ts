import { describe, expect, it } from 'vitest';

import {
  geodeticAt,
  normalizeLon,
  periodMinutes,
  satrecFromOmm,
  subpointAt,
} from '../lib/propagation';
import { EPOCH_DATE, S1A_RECORD } from './fixtures';

describe('SGP4 propagation (satellite.js)', () => {
  const satrec = satrecFromOmm(S1A_RECORD);

  it('produces a plausible sub-satellite point at epoch', () => {
    const point = subpointAt(satrec, EPOCH_DATE);
    expect(point).not.toBeNull();
    expect(point!.latDeg).toBeGreaterThanOrEqual(-90);
    expect(point!.latDeg).toBeLessThanOrEqual(90);
    expect(point!.altKm).toBeGreaterThan(600);
    expect(point!.altKm).toBeLessThan(800);
  });

  it('keeps longitude wrapped over many orbits', () => {
    for (let minutes = 0; minutes < 300; minutes += 1) {
      const point = subpointAt(satrec, new Date(EPOCH_DATE.getTime() + minutes * 60000));
      expect(point).not.toBeNull();
      expect(point!.lonDeg).toBeGreaterThanOrEqual(-180);
      expect(point!.lonDeg).toBeLessThan(180.000001);
    }
  });

  it('reports orbital velocity near LEO circular speed', () => {
    const state = geodeticAt(satrec, EPOCH_DATE);
    expect(state).not.toBeNull();
    expect(state!.velocityKmS).toBeGreaterThan(7.0);
    expect(state!.velocityKmS).toBeLessThan(8.0);
  });

  it('classifies ascending and descending arcs across an orbit', () => {
    const seen = new Set<string>();
    for (let minutes = 0; minutes < 99; minutes += 3) {
      const state = geodeticAt(satrec, new Date(EPOCH_DATE.getTime() + minutes * 60000));
      if (state) seen.add(state.ascending ? 'ascending' : 'descending');
    }
    expect(seen).toEqual(new Set(['ascending', 'descending']));
  });

  it('computes the orbital period from mean motion', () => {
    expect(periodMinutes(S1A_RECORD.MEAN_MOTION)).toBeCloseTo(98.68, 1);
  });

  it('normalises longitudes', () => {
    expect(normalizeLon(190)).toBeCloseTo(-170);
    expect(normalizeLon(-190)).toBeCloseTo(170);
    expect(normalizeLon(0)).toBe(0);
  });
});
