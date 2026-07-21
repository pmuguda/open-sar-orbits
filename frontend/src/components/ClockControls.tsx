import { JulianDate } from 'cesium';
import { useEffect, useState } from 'react';

import { filterSatellites } from '../lib/filtering';
import { fmtUtc } from '../lib/format';
import { useAppStore } from '../store/appStore';
import { globeBridge } from './globeBridge';

const SPEEDS = [1, 10, 60, 300, 1800] as const;

/** Bottom time console: simulation clock caption · speed controls · catalogue count. */
export default function ClockControls() {
  const satellites = useAppStore((s) => s.satellites);
  const filters = useAppStore((s) => s.filters);

  const [animating, setAnimating] = useState(true);
  const [multiplier, setMultiplier] = useState(60);
  const [simTime, setSimTime] = useState<string>(fmtUtc(new Date()));
  const [jumpValue, setJumpValue] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => {
      const viewer = globeBridge.viewer;
      if (!viewer || viewer.isDestroyed()) return;
      setAnimating(viewer.clock.shouldAnimate);
      setMultiplier(viewer.clock.multiplier);
      setSimTime(fmtUtc(JulianDate.toDate(viewer.clock.currentTime)));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const withClock = (fn: (clock: import('cesium').Clock) => void) => {
    const viewer = globeBridge.viewer;
    if (viewer && !viewer.isDestroyed()) {
      fn(viewer.clock);
    }
  };

  const visible = filterSatellites(satellites, filters).length;

  return (
    <div className="timeline" role="region" aria-label="Simulation time controls">
      <div className="tl-cap">
        <span className="k">Simulation clock</span>
        <span className="rng">{simTime}</span>
        <span className="dur">{animating ? `running · ${multiplier}× real time` : 'paused'}</span>
      </div>

      <div className="tl-ctr">
        <div className="seg" role="group" aria-label="Time animation">
          <button
            aria-pressed={!animating}
            title={animating ? 'Pause time' : 'Resume time'}
            onClick={() => withClock((c) => (c.shouldAnimate = !c.shouldAnimate))}
          >
            {animating ? '❚❚' : '▶'}
          </button>
          {SPEEDS.map((s) => (
            <button
              key={s}
              aria-pressed={multiplier === s}
              title={`${s}× real time`}
              onClick={() => withClock((c) => (c.multiplier = s))}
            >
              {s}×
            </button>
          ))}
          <button
            title="Jump to the current time"
            onClick={() =>
              withClock((c) => {
                c.currentTime = JulianDate.fromDate(new Date());
              })
            }
          >
            Now
          </button>
        </div>

        <label className="goto" title="Show positions at a chosen UTC time">
          <span className="k">Go&nbsp;to</span>
          <input
            type="datetime-local"
            className="field"
            value={jumpValue}
            onChange={(e) => {
              setJumpValue(e.target.value);
              const parsed = new Date(e.target.value + 'Z'); // input treated as UTC
              if (!Number.isNaN(parsed.getTime())) {
                withClock((c) => {
                  c.currentTime = JulianDate.fromDate(parsed);
                });
              }
            }}
          />
        </label>
      </div>

      <div className="tl-foot">
        <span className="k">In view</span>
        <span className="big">{visible}</span>
        <span className="sm">SAR satellites</span>
      </div>
    </div>
  );
}
