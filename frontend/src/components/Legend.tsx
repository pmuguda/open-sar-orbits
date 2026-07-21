import { useMemo, useState } from 'react';

import { constellationStyle } from '../lib/constellations';
import { filterSatellites } from '../lib/filtering';
import { useAppStore } from '../store/appStore';

/** Map-layer legend: colour + glyph per visible constellation (never colour alone). */
export default function Legend() {
  const satellites = useAppStore((s) => s.satellites);
  const filters = useAppStore((s) => s.filters);
  const [open, setOpen] = useState(true);

  const constellations = useMemo(() => {
    const names = new Map<string, number>();
    for (const sat of filterSatellites(satellites, filters)) {
      const name = sat.registry?.constellation ?? 'Uncatalogued';
      names.set(name, (names.get(name) ?? 0) + 1);
    }
    return [...names.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [satellites, filters]);

  if (constellations.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10 max-w-56">
      <div className="panel hairline border" style={{ background: 'var(--bg-2)' }}>
        <button
          className="panel-label flex w-full items-center justify-between px-2 py-1"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          Legend <span>{open ? '−' : '+'}</span>
        </button>
        {open && (
          <ul
            className="max-h-56 overflow-y-auto px-2 pb-2 text-xs"
            style={{ color: 'var(--text-2)' }}
          >
            {constellations.map(([name, count]) => {
              const style = constellationStyle(name === 'Uncatalogued' ? null : name);
              return (
                <li key={name} className="flex items-center gap-2 py-0.5">
                  <span className="sat-glyph" style={{ background: style.color }}>
                    {style.glyph}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="num faint">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
