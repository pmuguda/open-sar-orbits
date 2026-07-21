import { useState, type ReactNode } from 'react';

import { constellationStyle } from '../lib/constellations';
import { distinctValues, filterSatellites } from '../lib/filtering';
import { useAppStore, type ViewId } from '../store/appStore';

/** Left console rail: brand, view switcher, numbered modules, footer. */

function Module({
  index,
  title,
  meta,
  children,
  defaultOpen = true,
}: {
  index: string;
  title: string;
  meta: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`mod${open ? '' : ' is-collapsed'}`}>
      <button
        className="mod-h tray-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="ix">{index}</span>
        <span className="ttl">{title}</span>
        <span className="rule"></span>
        <span className="meta">{meta}</span>
        <span className="chev" aria-hidden="true"></span>
      </button>
      <div className="tray-body">{children}</div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="fld">
      <div className="flabel">
        <span>{label}</span>
        <span className="v">{value === '' ? 'ALL' : value}</span>
      </div>
      <div className="selx">
        <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
          <option value="">All</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'global', label: 'Globe' },
  { id: 'aoi', label: 'AOI passes' },
  { id: 'about', label: 'About' },
];

const BAND_COLORS: Record<string, string> = {
  C: 'var(--signal)',
  X: 'oklch(0.79 0.115 228)',
  L: 'oklch(0.72 0.185 40)',
};

export default function Console() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
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

  const filtered = filterSatellites(satellites, filters);

  // band tallies (C / X / L cover almost the whole catalogue)
  const bandCount = (band: string) =>
    filtered.filter((s) => s.registry?.frequency_band === band).length;
  const maxBand = Math.max(bandCount('C'), bandCount('X'), bandCount('L'), 1);

  // constellation breakdown of the current filter result
  const constellations = new Map<string, number>();
  for (const sat of filtered) {
    const name = sat.registry?.constellation ?? 'Uncatalogued';
    constellations.set(name, (constellations.get(name) ?? 0) + 1);
  }
  const breakdown = [...constellations.entries()].sort((a, b) => b[1] - a[1]);
  const maxConstellation = breakdown.length ? breakdown[0][1] : 1;

  return (
    <aside className="console" id="console">
      <div className="console-scroll">
        {/* identity */}
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none">
              <rect
                x="3.5"
                y="3.5"
                width="41"
                height="41"
                stroke="currentColor"
                strokeOpacity="0.45"
                strokeWidth="1.2"
              />
              <path
                d="M10 14h28M10 24h28M10 34h28M14 10v28M24 10v28M34 10v28"
                stroke="currentColor"
                strokeOpacity="0.16"
                strokeWidth="0.8"
              />
              <circle
                cx="24"
                cy="24"
                r="8.5"
                stroke="currentColor"
                strokeWidth="1.2"
                fillOpacity="0"
              />
              <ellipse
                cx="24"
                cy="24"
                rx="16.5"
                ry="6.5"
                transform="rotate(-24 24 24)"
                stroke="currentColor"
                strokeOpacity="0.65"
                strokeWidth="1"
              />
              <circle cx="9.4" cy="30.6" r="2.2" fill="oklch(0.81 0.16 156)" />
              <circle cx="38.2" cy="17.2" r="2.2" fill="oklch(0.79 0.115 228)" />
              <circle cx="28.5" cy="9.8" r="1.8" fill="oklch(0.72 0.185 40)" />
              <circle cx="24" cy="24" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <div className="wordmark">
            open<span className="sep">·</span>sar<span className="sep">·</span>orbits
          </div>
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
              Dark
            </button>
            <button aria-pressed={theme === 'paper'} onClick={() => setTheme('paper')}>
              Paper
            </button>
          </div>
          <div className="brand-desc">Live orbit console for public SAR constellations.</div>
          <div className="brand-sub">
            <span>
              <span className="tdot" style={{ background: BAND_COLORS.C }}></span> C
            </span>
            <span>
              <span className="tdot" style={{ background: BAND_COLORS.X }}></span> X
            </span>
            <span>
              <span className="tdot" style={{ background: BAND_COLORS.L }}></span> L-band
            </span>
            <span>SGP4 · CESIUM</span>
          </div>
        </div>

        {/* view switcher */}
        <div className="view-row">
          <nav className="seg" aria-label="Views">
            {VIEWS.map((v) => (
              <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
                {v.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 01 · FILTERS */}
        <Module index="01" title="Filters" meta={`${filtered.length}/${satellites.length} SATS`}>
          <div className="fld">
            <div className="flabel">
              <span>Search</span>
            </div>
            <input
              className="field"
              placeholder="Search by name…"
              aria-label="Search satellites by name"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
            />
          </div>
          <Select
            label="Constellation"
            value={filters.constellation}
            options={distinctValues(satellites, 'constellation')}
            onChange={(v) => setFilters({ constellation: v })}
          />
          <div className="grid grid-cols-2 gap-x-3">
            <Select
              label="Operator"
              value={filters.operator}
              options={distinctValues(satellites, 'operator')}
              onChange={(v) => setFilters({ operator: v })}
            />
            <Select
              label="Country"
              value={filters.country}
              options={distinctValues(satellites, 'country')}
              onChange={(v) => setFilters({ country: v })}
            />
            <Select
              label="Band"
              value={filters.band}
              options={distinctValues(satellites, 'frequency_band')}
              onChange={(v) => setFilters({ band: v })}
            />
            <Select
              label="Status"
              value={filters.status}
              options={distinctValues(satellites, 'status')}
              onChange={(v) => setFilters({ status: v })}
            />
          </div>
          <Select
            label="Open data"
            value={filters.openData}
            options={distinctValues(satellites, 'open_data_available')}
            onChange={(v) => setFilters({ openData: v })}
          />
          <button className="btn" style={{ marginTop: 13 }} onClick={resetFilters}>
            ↺ Reset filters
          </button>
        </Module>

        {/* 02 · COVERAGE */}
        <Module index="02" title="Coverage" meta={`${breakdown.length} GROUPS`}>
          <div className="cov">
            {(['C', 'X', 'L'] as const).map((band) => (
              <div key={band} className="cell" style={{ ['--sc' as string]: BAND_COLORS[band] }}>
                <div className="num">{bandCount(band)}</div>
                <div className="lab">{band}-band</div>
                <div className="bar">
                  <i style={{ width: `${(bandCount(band) / maxBand) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              margin: '16px 0 9px',
              fontSize: 10,
              letterSpacing: '.15em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            Constellation breakdown
          </div>
          <div className="modes">
            {breakdown.map(([name, count]) => {
              const style = constellationStyle(name === 'Uncatalogued' ? null : name);
              const active = filters.constellation === name;
              return (
                <button
                  key={name}
                  className={`mline${active ? ' on' : ''}`}
                  aria-pressed={active}
                  title={active ? 'Clear constellation filter' : `Filter to ${name}`}
                  onClick={() => setFilters({ constellation: active ? '' : name })}
                >
                  <span className="top">
                    <span className="mn" style={{ ['--sc' as string]: style.color }}>
                      <span className="g">{style.glyph}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                    </span>
                    <span className="mv">{count}</span>
                  </span>
                  <span className="track" style={{ display: 'block' }}>
                    <i
                      style={{
                        width: `${(count / maxConstellation) * 100}%`,
                        background: style.color,
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </Module>

        {/* 03 · SATELLITES */}
        <Module index="03" title="Satellites" meta={`${filtered.length} LISTED`}>
          <div className="sat-list" role="listbox" aria-label="Satellite list">
            {filtered.map((sat) => {
              const style = constellationStyle(sat.registry?.constellation);
              const active = selectedId === sat.norad_catalog_id;
              return (
                <button
                  key={sat.norad_catalog_id}
                  className="sat-row"
                  role="option"
                  aria-selected={active}
                  aria-pressed={active}
                  onClick={() => select(active ? null : sat.norad_catalog_id)}
                >
                  <span className="sat-glyph" style={{ background: style.color }}>
                    {style.glyph}
                  </span>
                  <span className="nm">{sat.object_name}</span>
                  <span className="bd">{sat.registry?.frequency_band ?? ''}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="sat-empty">No satellites match the filters.</p>}
          </div>
        </Module>

        {/* 04 · LAYERS */}
        <Module index="04" title="Layers" meta="GLOBE">
          <label className="toggle-row" title="Show satellite name labels on the globe">
            <input type="checkbox" checked={showLabels} onChange={() => toggleLayer('labels')} />
            Satellite labels
          </label>
          <label
            className="toggle-row"
            title="Show past/future orbit paths for all visible satellites"
          >
            <input type="checkbox" checked={showOrbits} onChange={() => toggleLayer('orbits')} />
            Orbit paths — all satellites
          </label>
          <label className="toggle-row" title="Project ground tracks for all visible satellites">
            <input
              type="checkbox"
              checked={showGroundTracks}
              onChange={() => toggleLayer('groundTracks')}
            />
            Ground tracks — all satellites
          </label>
          <p className="mod-note">The selected satellite always shows its orbit + ground track.</p>
        </Module>
      </div>

      {/* footer */}
      <div className="cfoot">
        <div className="cfoot-row">
          <span>
            By{' '}
            <a href="https://www.pmuguda.com/" target="_blank" rel="noopener noreferrer">
              Pavan Muguda Sanjeevamurthy
            </a>
          </span>
          <a
            className="icon-link"
            href="https://github.com/pmuguda/open-sar-orbits"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.61.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.33 1.08 2.9.83.09-.64.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 7.02c.85 0 1.7.11 2.5.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86v2.55c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
            </svg>
          </a>
          <a
            className="icon-link"
            href="https://ko-fi.com/pavan_muguda"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support on Ko-fi"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.793 1.904.989 1.832 2.694.723 4.141zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
            </svg>
          </a>
        </div>
        <div className="cfoot-row">
          <a
            className="kofi-link"
            href="https://ko-fi.com/pavan_muguda"
            target="_blank"
            rel="noopener noreferrer"
          >
            if it helped, support me on Ko-fi
          </a>
        </div>
      </div>
    </aside>
  );
}
