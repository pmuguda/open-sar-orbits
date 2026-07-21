import { useEffect } from 'react';

import { fetchOrbits, fetchSatellites, fetchStatus } from '../api/client';
import { validOmmRecords } from '../lib/omm';
import { useAppStore } from '../store/appStore';

const STATUS_POLL_MS = 5 * 60 * 1000;

/** Initial data load + light polling that follows the backend cache. */
export function useAppData(): void {
  const setData = useAppStore((s) => s.setData);
  const setError = useAppStore((s) => s.setError);
  const setLoading = useAppStore((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;
    let lastFetchedAt: string | null = null;

    async function loadAll() {
      const [orbits, satellites] = await Promise.all([fetchOrbits(), fetchSatellites()]);
      if (cancelled) return;
      lastFetchedAt = orbits.fetched_at;
      setData(satellites, validOmmRecords(orbits.records), {
        fetchedAt: orbits.fetched_at,
        ageSeconds: orbits.age_seconds,
        stale: orbits.stale,
        recordCount: orbits.record_count,
      });
    }

    setLoading(true);
    loadAll().catch((error: Error) => {
      if (!cancelled) setError(`Orbital data unavailable: ${error.message}`);
    });

    // poll the cheap status endpoint; refetch orbits only when the backend
    // cache actually advanced (the backend polls CelesTrak, never the browser)
    const timer = window.setInterval(() => {
      fetchStatus()
        .then((status) => {
          if (cancelled) return;
          if (status.orbit_cache.fetched_at && status.orbit_cache.fetched_at !== lastFetchedAt) {
            loadAll().catch(() => undefined);
          }
        })
        .catch(() => undefined); // transient status failures are non-fatal
    }, STATUS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setData, setError, setLoading]);
}
