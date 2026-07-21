import { JulianDate } from 'cesium';
import { useEffect, useState } from 'react';

import { filterSatellites } from '../lib/filtering';
import { fmtAge, fmtUtc } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { globeBridge } from './globeBridge';

/** Top-centre telemetry strip: data status · simulation UTC · counts · element age. */
export default function Coordbar() {
  const cacheMeta = useAppStore((s) => s.cacheMeta);
  const satellites = useAppStore((s) => s.satellites);
  const filters = useAppStore((s) => s.filters);

  const [simTime, setSimTime] = useState<string>(fmtUtc(new Date()));
  const [speed, setSpeed] = useState<number>(60);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const viewer = globeBridge.viewer;
      if (viewer && !viewer.isDestroyed()) {
        setSimTime(fmtUtc(JulianDate.toDate(viewer.clock.currentTime)));
        setSpeed(viewer.clock.shouldAnimate ? viewer.clock.multiplier : 0);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const visible = filterSatellites(satellites, filters).length;
  const status = !cacheMeta.fetchedAt ? 'NO DATA' : cacheMeta.stale ? 'STALE' : 'LIVE';

  return (
    <div className="coordbar" aria-live="polite">
      <div className="seg-c">
        <span className={cacheMeta.stale || !cacheMeta.fetchedAt ? 'stale' : 'live'}>
          <span className="blip"></span>
          {status}
        </span>
      </div>
      <div className="seg-c">
        <span className="k">UTC</span>
        <span className="num">{simTime}</span>
      </div>
      <div className="seg-c">
        <span className="k">SATS</span>
        <span className="num">
          {visible}/{satellites.length}
        </span>
      </div>
      <div className="seg-c">
        <span className="k">ELEMENTS</span>
        <span className="num">{fmtAge(cacheMeta.ageSeconds)}</span>
      </div>
      <div className="seg-c">
        <span className="k">SPEED</span>
        <span className="num">{speed === 0 ? '❚❚' : `${speed}×`}</span>
      </div>
    </div>
  );
}
