import { JulianDate } from 'cesium';
import { useEffect, useState } from 'react';

import { fmtAge, fmtUtc } from '../lib/format';
import { useAppStore, type ViewId } from '../store/appStore';
import { globeBridge } from './globeBridge';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'aoi', label: 'AOI passes' },
  { id: 'about', label: 'About' },
];

function simDate(): Date {
  const viewer = globeBridge.viewer;
  if (!viewer || viewer.isDestroyed()) return new Date();
  return JulianDate.toDate(viewer.clock.currentTime);
}

export default function TopBar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const cacheMeta = useAppStore((s) => s.cacheMeta);
  const satCount = useAppStore((s) => s.satellites.length);

  // mirror the Cesium simulation clock at 2 Hz
  const [simTime, setSimTime] = useState<string>(fmtUtc(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setSimTime(fmtUtc(simDate())), 500);
    return () => window.clearInterval(timer);
  }, []);

  const dataChip = cacheMeta.fetchedAt
    ? cacheMeta.stale
      ? { label: 'STALE DATA', className: 'chip' }
      : { label: 'LIVE', className: 'chip chip--live' }
    : { label: 'NO DATA', className: 'chip' };

  return (
    <header
      className="hairline flex h-12 flex-none items-center gap-4 border-b px-4"
      style={{ background: 'var(--bg)' }}
    >
      <span className="cond text-sm tracking-wide" style={{ color: 'var(--white)' }}>
        OPEN&nbsp;SAR&nbsp;ORBITS
      </span>
      <span className="code-deco hidden text-xs md:inline">SAR constellation explorer</span>

      <nav className="seg ml-2" aria-label="Views">
        {VIEWS.map((v) => (
          <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto hidden items-center lg:flex">
        <div className="telemetry" aria-live="polite">
          <span className="seg-c">
            <span className="k">UTC</span>
            <span className="num">{simTime}</span>
          </span>
          <span className="seg-c">
            <span className="k">SATS</span>
            <span className="num">{satCount}</span>
          </span>
          <span className="seg-c">
            <span className="k">ELEMENTS</span>
            <span className="num">{fmtAge(cacheMeta.ageSeconds)}</span>
          </span>
          <span className="seg-c" title="Orbital data source status">
            <span className={dataChip.className}>{dataChip.label}</span>
          </span>
        </div>
      </div>

      <div className="seg" role="group" aria-label="Colour theme">
        <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
          Dark
        </button>
        <button aria-pressed={theme === 'paper'} onClick={() => setTheme('paper')}>
          Paper
        </button>
      </div>
    </header>
  );
}
