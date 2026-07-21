/** Ground-track helpers: split a sampled track at the antimeridian so Cesium
 * never draws a horizontal line across the whole globe. */

export interface TrackSample {
  lonDeg: number;
  latDeg: number;
}

/** Returns segments as flat [lon, lat, lon, lat, ...] arrays. */
export function splitTrackSegments(samples: TrackSample[]): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  let previousLon: number | null = null;

  for (const sample of samples) {
    if (previousLon !== null && Math.abs(sample.lonDeg - previousLon) > 180) {
      if (current.length >= 4) segments.push(current);
      current = [];
    }
    current.push(sample.lonDeg, sample.latDeg);
    previousLon = sample.lonDeg;
  }
  if (current.length >= 4) segments.push(current);
  return segments;
}
