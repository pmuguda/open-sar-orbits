import { JulianDate } from 'cesium';
import { useEffect, useState } from 'react';

import { globeBridge } from './globeBridge';

const SPEEDS = [1, 10, 60, 300, 1800] as const;

/** Overlay controls for the Cesium simulation clock. */
export default function ClockControls() {
  const [animating, setAnimating] = useState(true);
  const [multiplier, setMultiplier] = useState(60);
  const [jumpValue, setJumpValue] = useState('');

  // keep local UI state in sync with the actual clock
  useEffect(() => {
    const timer = window.setInterval(() => {
      const viewer = globeBridge.viewer;
      if (!viewer || viewer.isDestroyed()) return;
      setAnimating(viewer.clock.shouldAnimate);
      setMultiplier(viewer.clock.multiplier);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const withClock = (fn: (clock: import('cesium').Clock) => void) => {
    const viewer = globeBridge.viewer;
    if (viewer && !viewer.isDestroyed()) {
      fn(viewer.clock);
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="flex flex-wrap items-center gap-2">
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

        <label className="flex items-center gap-1" title="Show positions at a chosen UTC time">
          <span className="panel-label">Go&nbsp;to</span>
          <input
            type="datetime-local"
            className="field"
            style={{ height: 30, width: 190, fontSize: 11 }}
            value={jumpValue}
            onChange={(e) => {
              setJumpValue(e.target.value);
              const parsed = new Date(e.target.value + 'Z'); // treat input as UTC
              if (!Number.isNaN(parsed.getTime())) {
                withClock((c) => {
                  c.currentTime = JulianDate.fromDate(parsed);
                });
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}
