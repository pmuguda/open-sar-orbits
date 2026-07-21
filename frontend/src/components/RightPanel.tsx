import { JulianDate } from 'cesium';
import { useEffect, useMemo, useState } from 'react';

import { constellationStyle } from '../lib/constellations';
import { fmt, fmtAge, fmtNum, UNKNOWN } from '../lib/format';
import { geodeticAt, satrecFromOmm, type GeodeticState } from '../lib/propagation';
import { useAppStore } from '../store/appStore';
import { globeBridge } from './globeBridge';

function Row({ k, v, title }: { k: string; v: string; title?: string }) {
  return (
    <tr title={title}>
      <td>{k}</td>
      <td>{v}</td>
    </tr>
  );
}

/** Overlay detail panel (right edge), same pattern as the triad scene panel. */
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

  if (!sat) return null;

  const registry = sat.registry ?? null;
  const style = constellationStyle(registry?.constellation);
  const epochAgeS = sat.epoch ? (simMs - Date.parse(sat.epoch)) / 1000 : null;
  const visible = open;

  return (
    <>
      <button
        className={`detail-toggle${visible ? '' : ' closed'}`}
        title={visible ? 'Hide the detail panel' : 'Show the detail panel'}
        aria-label={visible ? 'Hide the detail panel' : 'Show the detail panel'}
        onClick={() => togglePanel('right')}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>

      <div className={`detail-panel${visible ? '' : ' hidden'}`} aria-label="Satellite detail">
        <div className="detail-content">
          <div className="detail-provider" style={{ ['--sc' as string]: style.color }}>
            <span className="d"></span>
            {registry?.constellation ?? 'Uncatalogued'}
            {registry?.status && (
              <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>{registry.status}</span>
            )}
          </div>
          <h2 className="detail-name">{sat.object_name}</h2>
          <div className="detail-id">
            NORAD {sat.norad_catalog_id} · {sat.international_designator ?? UNKNOWN}
            {sat.registry_match === 'pattern' && ' · constellation-level metadata'}
          </div>

          <div className="detail-sec">Live state · sim time</div>
          <table className="detail-table" aria-live="polite">
            <tbody>
              <Row k="Latitude" v={live ? fmtNum(live.latDeg, 3, '°') : UNKNOWN} />
              <Row k="Longitude" v={live ? fmtNum(live.lonDeg, 3, '°') : UNKNOWN} />
              <Row k="Altitude" v={live ? fmtNum(live.altKm, 1, ' km') : UNKNOWN} />
              <Row k="Velocity" v={live ? fmtNum(live.velocityKmS, 2, ' km/s') : UNKNOWN} />
              <Row
                k="Pass dir"
                v={live ? (live.ascending ? 'ascending ↑' : 'descending ↓') : UNKNOWN}
                title="Ascending = moving south to north"
              />
            </tbody>
          </table>

          <div className="detail-sec">Orbit</div>
          <table className="detail-table">
            <tbody>
              <Row
                k="Epoch"
                v={sat.epoch ? sat.epoch.replace('T', ' ').slice(0, 19) + 'Z' : UNKNOWN}
              />
              <Row
                k="Element age"
                v={fmtAge(epochAgeS)}
                title="Age of the orbital elements at the simulation time — accuracy degrades with age"
              />
              <Row k="Inclination" v={fmtNum(sat.inclination_deg, 2, '°')} />
              <Row k="Period" v={fmtNum(sat.period_minutes, 1, ' min')} />
              <Row k="Repeat cycle" v={fmt(registry?.repeat_cycle_days, ' d')} />
            </tbody>
          </table>

          <div className="detail-sec">SAR sensor</div>
          <table className="detail-table">
            <tbody>
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
            </tbody>
          </table>

          <div className="detail-sec">Mission</div>
          <table className="detail-table">
            <tbody>
              <Row k="Operator" v={fmt(registry?.operator)} />
              <Row k="Country" v={fmt(registry?.country)} />
              <Row k="Launched" v={fmt(registry?.launch_date)} />
            </tbody>
          </table>

          <div className="detail-actions">
            <button
              className="detail-action-btn primary"
              aria-pressed={follow}
              onClick={() => setFollow(!follow)}
            >
              {follow ? '◉ Following — click to release' : '○ Follow with camera'}
            </button>
            {registry?.documentation_url && (
              <a
                className="detail-action-btn"
                href={registry.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mission documentation ↗
              </a>
            )}
            {registry?.archive_url && (
              <a
                className="detail-action-btn"
                href={registry.archive_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Data archive ↗
              </a>
            )}
            {registry?.provider_url && (
              <a
                className="detail-action-btn"
                href={registry.provider_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Operator site ↗
              </a>
            )}
            <button className="detail-action-btn" onClick={() => select(null)}>
              ✕ Deselect
            </button>
          </div>

          {registry?.metadata_source && (
            <p className="detail-note">
              metadata: {registry.metadata_source} · verified {registry.metadata_last_verified}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
