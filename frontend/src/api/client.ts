import type { MergedSatellite, OrbitsResponse, StatusResponse } from '../types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * Static mode (GitHub Pages): a scheduled Action bakes the backend responses
 * into /data/*.json at build time, so the app runs without a live backend —
 * and browsers still never talk to CelesTrak directly.
 */
const STATIC = import.meta.env.VITE_STATIC_DATA === '1';
const staticUrl = (name: string) => `${import.meta.env.BASE_URL}data/${name}.json`;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* keep the HTTP status text */
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export function fetchOrbits(): Promise<OrbitsResponse> {
  return getJson<OrbitsResponse>(STATIC ? staticUrl('orbits') : `${BASE}/api/orbits/current`);
}

export function fetchSatellites(): Promise<MergedSatellite[]> {
  return getJson<MergedSatellite[]>(STATIC ? staticUrl('satellites') : `${BASE}/api/satellites`);
}

export function fetchStatus(): Promise<StatusResponse> {
  return getJson<StatusResponse>(STATIC ? staticUrl('status') : `${BASE}/api/metadata/status`);
}
