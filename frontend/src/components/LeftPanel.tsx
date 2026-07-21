import { constellationStyle } from '../lib/constellations';
import { distinctValues, filterSatellites } from '../lib/filtering';
import { useAppStore } from '../store/appStore';

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterSelect({ label, value, options, onChange }: SelectProps) {
  return (
    <label className="block">
      <span className="panel-label">{label}</span>
      <select
        className="field mt-1"
        style={{ height: 30, fontSize: 11 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function LeftPanel() {
  const satellites = useAppStore((s) => s.satellites);
  const filters = useAppStore((s) => s.filters);
  const setFilters = useAppStore((s) => s.setFilters);
  const resetFilters = useAppStore((s) => s.resetFilters);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);
  const showLabels = useAppStore((s) => s.showLabels);
  const showOrbits = useAppStore((s) => s.showOrbits);
  const showGroundTracks = useAppStore((s) => s.showGroundTracks);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const open = useAppStore((s) => s.leftOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);

  const filtered = filterSatellites(satellites, filters);

  if (!open) {
    return (
      <button
        className="hairline w-6 flex-none border-r text-xs"
        style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}
        onClick={() => togglePanel('left')}
        title="Open the satellite panel"
        aria-label="Open the satellite panel"
      >
        ›
      </button>
    );
  }

  return (
    <aside className="panel hairline flex w-72 flex-none flex-col border-r">
      <div className="hairline flex items-center justify-between border-b px-3 py-2">
        <span className="panel-label">
          Satellites <span className="num">{filtered.length}</span>/
          <span className="num">{satellites.length}</span>
        </span>
        <button
          className="btn--ghost btn px-1 py-0"
          style={{ padding: '0 6px' }}
          onClick={() => togglePanel('left')}
          title="Collapse the satellite panel"
          aria-label="Collapse the satellite panel"
        >
          ‹
        </button>
      </div>

      <div className="hairline space-y-2 border-b p-3">
        <input
          className="field"
          placeholder="Search by name…"
          aria-label="Search satellites by name"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label="Constellation"
            value={filters.constellation}
            options={distinctValues(satellites, 'constellation')}
            onChange={(v) => setFilters({ constellation: v })}
          />
          <FilterSelect
            label="Operator"
            value={filters.operator}
            options={distinctValues(satellites, 'operator')}
            onChange={(v) => setFilters({ operator: v })}
          />
          <FilterSelect
            label="Country"
            value={filters.country}
            options={distinctValues(satellites, 'country')}
            onChange={(v) => setFilters({ country: v })}
          />
          <FilterSelect
            label="Band"
            value={filters.band}
            options={distinctValues(satellites, 'frequency_band')}
            onChange={(v) => setFilters({ band: v })}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={distinctValues(satellites, 'status')}
            onChange={(v) => setFilters({ status: v })}
          />
          <FilterSelect
            label="Open data"
            value={filters.openData}
            options={distinctValues(satellites, 'open_data_available')}
            onChange={(v) => setFilters({ openData: v })}
          />
        </div>
        <button
          className="btn btn--outline w-full"
          style={{ padding: '4px 0' }}
          onClick={resetFilters}
        >
          Reset filters
        </button>
      </div>

      <div className="hairline border-b p-3">
        <span className="panel-label">Layers</span>
        <label className="toggle-row" title="Show satellite name labels on the globe">
          <input type="checkbox" checked={showLabels} onChange={() => toggleLayer('labels')} />
          Satellite labels
        </label>
        <label
          className="toggle-row"
          title="Show past/future orbit paths for all visible satellites"
        >
          <input type="checkbox" checked={showOrbits} onChange={() => toggleLayer('orbits')} />
          Orbit paths (all)
        </label>
        <label className="toggle-row" title="Project ground tracks for all visible satellites">
          <input
            type="checkbox"
            checked={showGroundTracks}
            onChange={() => toggleLayer('groundTracks')}
          />
          Ground tracks (all)
        </label>
        <p className="faint mt-1 text-xs">
          The selected satellite always shows its orbit + ground track.
        </p>
      </div>

      <div className="panel-scroll flex-1 p-2" role="listbox" aria-label="Satellite list">
        {filtered.map((sat) => {
          const style = constellationStyle(sat.registry?.constellation);
          return (
            <button
              key={sat.norad_catalog_id}
              className="sat-row"
              role="option"
              aria-selected={selectedId === sat.norad_catalog_id}
              aria-pressed={selectedId === sat.norad_catalog_id}
              onClick={() =>
                select(selectedId === sat.norad_catalog_id ? null : sat.norad_catalog_id)
              }
            >
              <span className="sat-glyph" style={{ background: style.color }}>
                {style.glyph}
              </span>
              <span className="min-w-0 flex-1 truncate">{sat.object_name}</span>
              <span className="faint text-[10px]">{sat.registry?.frequency_band ?? ''}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="code-deco p-3 text-xs">no satellites match the filters</p>
        )}
      </div>
    </aside>
  );
}
