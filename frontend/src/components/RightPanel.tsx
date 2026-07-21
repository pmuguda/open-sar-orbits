import { JulianDate } from 'cesium';
import { useEffect, useMemo, useState } from 'react';

import { constellationStyle } from '../lib/constellations';
import { fmt, fmtAge, fmtNum, UNKNOWN } from '../lib/format';
import { geodeticAt, satrecFromOmm, type GeodeticState } from '../lib/propagation';
import { useAppStore } from '../store/appStore';
import { globeBridge } from './globeBridge';

function Row({ k, v, title }: { k: string; v: string; title?: string }) {
  return (
    <>
      <dt title={title}>{k}</dt>
      <dd className="num">{v}</dd>
    </>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs">
      › {label}
    </a>
  );
}

export default function RightPanel() {
  const selectedId = useAppStore((s) => s.selectedId);
  const satellites = useAppStore((s) => s.satellites);
  const records = useAppStore((s) => s.records);
  const follow = useAppStore((s) => s.follow);
  const setFollow = useAppStore((s) => s.setFollow);
  const select = useAppStore((s) => s.select);
  const open = useAppStore((s) => s.rightOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);

  const sat = satellites.find((s) => s.norad_catalog_id === selectedId) ?? null;
  const record = records.find((r) => r.NORAD_CAT_ID === selectedId) ?? null;
  const satrec = useMemo(() => (record ? satrecFromOmm(record) : null), [record]);

  // live readout at 1 Hz against the simulation clock
  const [live, setLive] = useState<GeodeticState | null>(null);
  const [simMs, setSimMs] = useState<number>(Date.now());
  useEffect(() => {
    if (!satrec) {
      setLive(null);
      return;
    }
    const tick = () => {
      const viewer = globeBridge.viewer;
      const date =
        viewer && !viewer.isDestroyed() ? JulianDate.toDate(viewer.clock.currentTime) : new Date();
      setSimMs(date.getTime());
      setLive(geodeticAt(satrec, date));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [satrec]);

  if (!open) {
    return (
      <button
        className="hairline w-6 flex-none border-l text-xs"
        style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}
        onClick={() => togglePanel('right')}
        title="Open the detail panel"
        aria-label="Open the detail panel"
      >
        ‹
      </button>
    );
  }

  const registry = sat?.registry ?? null;
  const style = constellationStyle(registry?.constellation);
  const epochAgeS = sat?.epoch ? (simMs - Date.parse(sat.epoch)) / 1000 : null;

  return (
    <aside className="panel hairline flex w-80 flex-none flex-col border-l">
      <div className="hairline flex items-center justify-between border-b px-3 py-2">
        <span className="panel-label">Satellite detail</span>
        <button
          className="btn btn--ghost"
          style={{ padding: '0 6px' }}
          onClick={() => togglePanel('right')}
          title="Collapse the detail panel"
          aria-label="Collapse the detail panel"
        >
          ›
        </button>
      </div>

      {!sat ? (
        <p className="code-deco p-4 text-xs">select a satellite on the globe or in the list</p>
      ) : (
        <div className="panel-scroll flex-1 space-y-4 p-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="sat-glyph" style={{ background: style.color }}>
                {style.glyph}
              </span>
              <h2 className="text-sm" style={{ color: 'var(--white)' }}>
                {sat.object_name}
              </h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {registry?.constellation && <span className="tag">{registry.constellation}</span>}
              {registry?.status && (
                <span className={registry.status === 'active' ? 'chip chip--signal' : 'chip'}>
                  {registry.status}
                </span>
              )}
              {registry?.open_data_available === 'yes' && <span className="tag">open data</span>}
            </div>
            {sat.registry_match === 'pattern' && (
              <p className="faint mt-1 text-[11px]">
                constellation-level metadata (name-pattern match)
              </p>
            )}
          </div>

          <div>
            <span className="panel-label">Live state · simulation time</span>
            <dl className="kv mt-1" aria-live="polite">
              <Row k="Latitude" v={live ? fmtNum(live.latDeg, 3, '°') : UNKNOWN} />
              <Row k="Longitude" v={live ? fmtNum(live.lonDeg, 3, '°') : UNKNOWN} />
              <Row k="Altitude" v={live ? fmtNum(live.altKm, 1, ' km') : UNKNOWN} />
              <Row k="Velocity" v={live ? fmtNum(live.velocityKmS, 2, ' km/s') : UNKNOWN} />
              <Row
                k="Pass dir"
                v={live ? (live.ascending ? 'ascending ↑' : 'descending ↓') : UNKNOWN}
                title="Ascending = moving south to north"
              />
            </dl>
          </div>

          <div>
            <span className="panel-label">Orbit</span>
            <dl className="kv mt-1">
              <Row k="NORAD ID" v={String(sat.norad_catalog_id)} />
              <Row k="Intl desig" v={fmt(sat.international_designator)} />
              <Row k="Epoch" v={fmt(sat.epoch?.replace('T', ' ').replace('Z', ' Z'))} />
              <Row
                k="Element age"
                v={fmtAge(epochAgeS)}
                title="Age of the orbital elements at the simulation time — accuracy degrades with age"
              />
              <Row k="Inclination" v={fmtNum(sat.inclination_deg, 2, '°')} />
              <Row k="Period" v={fmtNum(sat.period_minutes, 1, ' min')} />
              <Row k="Repeat cycle" v={fmt(registry?.repeat_cycle_days, ' d')} />
            </dl>
          </div>

          <div>
            <span className="panel-label">SAR sensor</span>
            <dl className="kv mt-1">
              <Row k="Band" v={fmt(registry?.frequency_band)} />
              <Row k="Centre freq" v={fmt(registry?.centre_frequency_ghz, ' GHz')} />
              <Row k="Polarisation" v={registry?.polarisation_modes?.join(', ') ?? UNKNOWN} />
              <Row
                k="Best res"
                v={fmt(registry?.minimum_resolution_m, ' m')}
                title="Finest publicly documented mode"
              />
              <Row
                k="Max swath"
                v={fmt(registry?.maximum_swath_width_km, ' km')}
                title="Widest publicly documented mode"
              />
              <Row k="Look dir" v={fmt(registry?.look_direction)} />
              <Row
                k="Incidence"
                v={
                  registry?.minimum_incidence_angle_deg != null &&
                  registry?.maximum_incidence_angle_deg != null
                    ? `${registry.minimum_incidence_angle_deg}–${registry.maximum_incidence_angle_deg}°`
                    : UNKNOWN
                }
              />
              <Row k="Open data" v={fmt(registry?.open_data_available)} />
            </dl>
          </div>

          <div>
            <span className="panel-label">Mission</span>
            <dl className="kv mt-1">
              <Row k="Operator" v={fmt(registry?.operator)} />
              <Row k="Country" v={fmt(registry?.country)} />
              <Row k="Launched" v={fmt(registry?.launch_date)} />
            </dl>
            <div className="mt-2 space-y-1">
              <LinkRow label="Mission documentation" url={registry?.documentation_url} />
              <LinkRow label="Data archive" url={registry?.archive_url} />
              <LinkRow label="Operator site" url={registry?.provider_url} />
            </div>
            {registry?.metadata_source && (
              <p className="faint mt-2 text-[10px]">
                metadata: {registry.metadata_source} · verified {registry.metadata_last_verified}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              className={follow ? 'btn flex-1' : 'btn btn--outline flex-1'}
              style={{ padding: '6px 0', justifyContent: 'center' }}
              aria-pressed={follow}
              onClick={() => setFollow(!follow)}
            >
              {follow ? 'Following' : 'Follow'}
            </button>
            <button
              className="btn btn--outline flex-1"
              style={{ padding: '6px 0', justifyContent: 'center' }}
              onClick={() => select(null)}
            >
              Deselect
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
