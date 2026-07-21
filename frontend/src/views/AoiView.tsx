import Disclaimer from '../components/Disclaimer';

/**
 * Phase 2 shell: the backend pass-prediction API is live; the drawing UI,
 * results table, timeline and exports land in Phase 2.
 */
export default function AoiView() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="sec-label">AOI pass analysis</div>
      <h1 className="sec-title">
        Upcoming <span>passes</span> over an area
      </h1>

      <p className="prose text-sm" style={{ color: 'var(--text-2)' }}>
        Draw an AOI (point + radius, bounding box or polygon — GeoJSON upload supported), pick a
        window (24 h / 3 d / 7 d / custom) and get every predicted orbital pass with closest
        approach time, minimum distance, direction and a confidence grade.
      </p>

      <div className="mt-4">
        <Disclaimer />
      </div>

      <div className="card card--rule mt-6">
        <p className="card__meta">STATUS</p>
        <p className="mt-1 text-sm">
          <span className="chip">{'{ }'} PHASE 2 — UI IN PROGRESS</span>
        </p>
        <p className="prose mt-3 text-sm" style={{ color: 'var(--text-2)' }}>
          The prediction engine is already live on the backend (the hosted GitHub Pages demo is a
          static snapshot without it — run the backend locally). Until the drawing tools land you
          can query it directly:
        </p>
        <pre
          className="mt-3 overflow-x-auto border p-3 text-[11px] leading-relaxed hairline"
          style={{ background: 'var(--bg-2)', color: 'var(--text-2)' }}
        >
          {`curl -X POST http://localhost:8000/api/passes \\
  -H 'Content-Type: application/json' \\
  -d '{
    "geometry": {"type": "Point", "coordinates": [36.82, -1.29]},
    "start_time": "2026-07-21T00:00:00Z",
    "end_time":   "2026-07-24T00:00:00Z",
    "maximum_distance_km": 500
  }'`}
        </pre>
        <p className="prose mt-3 text-sm" style={{ color: 'var(--text-2)' }}>
          Planned for this view: sortable results table · pass timeline · highlighted orbit and
          ground-track segments on the globe · CSV and GeoJSON export.
        </p>
      </div>
    </div>
  );
}
