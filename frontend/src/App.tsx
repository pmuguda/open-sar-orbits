import ClockControls from './components/ClockControls';
import GlobeView from './components/GlobeView';
import LeftPanel from './components/LeftPanel';
import Legend from './components/Legend';
import RightPanel from './components/RightPanel';
import TopBar from './components/TopBar';
import { useAppData } from './hooks/useAppData';
import { fmtAge } from './lib/format';
import { useAppStore } from './store/appStore';
import AboutView from './views/AboutView';
import AoiView from './views/AoiView';

export default function App() {
  useAppData();
  const view = useAppStore((s) => s.view);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const cacheMeta = useAppStore((s) => s.cacheMeta);

  return (
    <div className="flex h-full flex-col font-mono">
      <TopBar />

      {cacheMeta.stale && (
        <div
          className="flex-none px-4 py-1 text-center text-xs"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          role="status"
        >
          Serving cached orbital data from {fmtAge(cacheMeta.ageSeconds)} ago — CelesTrak has not
          been reachable. Positions may be inaccurate.
        </div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <LeftPanel />

        <main className="relative min-w-0 flex-1" style={{ background: 'var(--bg)' }}>
          <GlobeView />
          <ClockControls />
          <Legend />

          {loading && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--bg) 70%, transparent)' }}
              role="status"
            >
              <span className="chip chip--live">ACQUIRING ORBITAL ELEMENTS</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-x-0 top-4 z-20 flex justify-center px-4">
              <div
                className="card max-w-lg text-xs"
                style={{ borderColor: 'var(--accent-line)' }}
                role="alert"
              >
                <p className="card__meta">ERROR</p>
                <p className="mt-1" style={{ color: 'var(--text)' }}>
                  {error}
                </p>
                <p className="faint mt-2">
                  Is the backend running? <code>uvicorn app.main:app --port 8000</code>
                </p>
              </div>
            </div>
          )}
        </main>

        <RightPanel />

        {view !== 'global' && (
          <div
            className="absolute inset-0 z-30 overflow-y-auto"
            style={{ background: 'var(--bg)' }}
          >
            {view === 'aoi' ? <AoiView /> : <AboutView />}
          </div>
        )}
      </div>
    </div>
  );
}
