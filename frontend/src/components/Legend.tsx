import { useMemo } from 'react';

import { filterSatellites } from '../lib/filtering';
import { useAppStore } from '../store/appStore';

const BAND_COLORS: Record<string, string> = {
  C: 'var(--signal)',
  X: 'oklch(0.79 0.115 228)',
  L: 'oklch(0.72 0.185 40)',
  S: 'oklch(0.83 0.135 82)',
  P: 'oklch(0.65 0.15 300)',
  'L+S': 'oklch(0.72 0.12 200)',
};

/** Top-left quick chips: frequency-band tallies, click to filter by band. */
export default function Legend() {
  const satellites = useAppStore((s) => s.satellites);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);

  const bands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sat of filterSatellites(satellites, { ...filters, band: '' })) {
      const band = sat.registry?.frequency_band;
      if (band) counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [satellites, filters]);

  if (bands.length === 0) return null;

  return (
    <div className="maplegend" role="group" aria-label="Filter by frequency band">
      {bands.map(([band, count]) => {
        const active = filters.band === band;
        const dimmed = filters.band !== '' && !active;
        return (
          <button
            key={band}
            className={`lg${dimmed ? ' off' : ''}`}
            aria-pressed={active}
            title={active ? 'Clear band filter' : `Show only ${band}-band satellites`}
            style={{ ['--sc' as string]: BAND_COLORS[band] ?? 'var(--accent)' }}
            onClick={() => setFilters({ band: active ? '' : band })}
          >
            <span className="d"></span>
            {band}
            <span className="n num">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
