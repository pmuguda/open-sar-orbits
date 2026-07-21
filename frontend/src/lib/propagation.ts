/**
 * satellite.js SGP4 wrappers. This module is imported by both the UI thread
 * (single-satellite readouts) and the Web Worker (batch trajectory sampling).
 */
import { eciToGeodetic, gstime, json2satrec, propagate } from 'satellite.js';
import type { SatRec } from 'satellite.js';

import type { OmmRecord } from '../types';

export interface Subpoint {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export interface GeodeticState extends Subpoint {
  velocityKmS: number;
  ascending: boolean;
}

export function satrecFromOmm(record: OmmRecord): SatRec {
  return json2satrec(record as Parameters<typeof json2satrec>[0]);
}

const RAD = 180 / Math.PI;

/** Wrap a longitude into [-180, 180). */
export function normalizeLon(lonDeg: number): number {
  let wrapped = ((lonDeg + 180) % 360) - 180;
  if (wrapped < -180) wrapped += 360;
  return wrapped;
}

/** Sub-satellite point at a date, or null when SGP4 fails (decayed orbit etc). */
export function subpointAt(satrec: SatRec, date: Date): Subpoint | null {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  if (!Number.isFinite(geo.latitude) || !Number.isFinite(geo.height)) return null;
  return {
    latDeg: geo.latitude * RAD,
    lonDeg: normalizeLon(geo.longitude * RAD),
    altKm: geo.height,
  };
}

/** Full readout for the detail panel: position + speed + pass direction. */
export function geodeticAt(satrec: SatRec, date: Date): GeodeticState | null {
  const pv = propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const velocity =
    pv.velocity && typeof pv.velocity !== 'boolean'
      ? Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z)
      : NaN;
  const ahead = subpointAt(satrec, new Date(date.getTime() + 1000));
  const latDeg = geo.latitude * RAD;
  return {
    latDeg,
    lonDeg: normalizeLon(geo.longitude * RAD),
    altKm: geo.height,
    velocityKmS: velocity,
    ascending: ahead !== null && ahead.latDeg > latDeg,
  };
}

export function periodMinutes(meanMotionRevPerDay: number): number {
  return 1440 / meanMotionRevPerDay;
}
