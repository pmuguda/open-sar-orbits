import type { MergedSatellite, OrbitsResponse, StatusResponse } from '../types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' } });
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
  return getJson<OrbitsResponse>('/api/orbits/current');
}

export function fetchSatellites(): Promise<MergedSatellite[]> {
  return getJson<MergedSatellite[]>('/api/satellites');
}

export function fetchStatus(): Promise<StatusResponse> {
  return getJson<StatusResponse>('/api/metadata/status');
}
