import ClockControls from './components/ClockControls';
import Console from './components/Console';
import Coordbar from './components/Coordbar';
import GlobeView from './components/GlobeView';
import Legend from './components/Legend';
import RightPanel from './components/RightPanel';
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
  const leftOpen = useAppStore((s) => s.leftOpen);
  const togglePanel = useAppStore((s) => s.togglePanel);

  return (
    <div className={`app${leftOpen ? '' : ' collapsed'}`}>
      <Console />

      <button
        className="collapse"
        aria-label="Toggle console"
        title="Toggle console"
        onClick={() => togglePanel('left')}
      >
        <span className="cv">‹</span>
      </button>

      <main className="viewport">
        <GlobeView />

        {/* instrument chrome */}
        <div className="mo" aria-hidden="true">
          <div className="corner tl"></div>
          <div className="corner tr"></div>
          <div className="corner bl"></div>
          <div className="corner br"></div>
        </div>

        <Coordbar />
        <Legend />
        <ClockControls />
        <RightPanel />

        {cacheMeta.stale && (
          <div className="hint-banner" role="status">
            Serving cached orbital data from {fmtAge(cacheMeta.ageSeconds)} ago — CelesTrak
            unreachable. Positions may be inaccurate.
          </div>
        )}

        {loading && (
          <div className="loading-overlay" role="status">
            <div className="spinner"></div>
            <p>Acquiring orbital elements…</p>
          </div>
        )}

        {error && (
          <div className="error-card" role="alert">
            <span className="k">Error</span>
            {error}
            <br />
            <span className="faint">
              Is the backend running? <code>uvicorn app.main:app --port 8000</code>
            </span>
          </div>
        )}

        {view !== 'global' && (
          <div className="docpage">{view === 'aoi' ? <AoiView /> : <AboutView />}</div>
        )}
      </main>
    </div>
  );
}
