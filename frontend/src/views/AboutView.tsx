import Disclaimer from '../components/Disclaimer';

/** About & methodology — mirrors docs/methodology.md. */
export default function AboutView() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="sec-label">About</div>
      <h1 className="sec-title">
        Open SAR <span>Orbits</span>
      </h1>
      <p className="prose text-sm" style={{ color: 'var(--text-2)' }}>
        An open-source explorer for the orbits of publicly catalogued Synthetic Aperture Radar
        satellites: where they are, where they are heading, and when they will pass near an area of
        interest. Built for SAR researchers, EO analysts, students and disaster-response analysts.
      </p>

      <div className="sec-label mt-10">Data sources</div>
      <ul className="prose space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
        <li>
          › <strong>Orbital elements</strong> — CelesTrak general-perturbation (GP) elements in OMM
          JSON, collected with one <code>NAME=</code> query per SAR mission family, merged,
          deduplicated by NORAD ID and filtered against the curated registry. Fetched by the backend
          only (default every 6 h), cached in SQLite, and served to every browser session from that
          cache. If CelesTrak is unreachable the last valid set keeps serving and the header chip
          flips from LIVE to STALE once it is older than 24 h.
        </li>
        <li>
          › <strong>Mission &amp; sensor metadata</strong> — a curated registry compiled only from
          public sources (agency mission pages, vendor documentation, eoPortal). Every entry records
          its source and verification date. Values that are not publicly documented are shown as{' '}
          <code>···</code> — never guessed.
        </li>
      </ul>

      <div className="sec-label mt-10">SGP4 propagation &amp; its limits</div>
      <p className="prose text-sm" style={{ color: 'var(--text-2)' }}>
        Positions are computed with the standard SGP4 analytical propagator (satellite.js in your
        browser, python-sgp4 on the server) from mean elements, then converted TEME → Earth-fixed →
        geodetic (WGS-84). Expect roughly 1–3 km of error near the element epoch, growing by a few
        km per day of element age; predicted pass times drift accordingly. Every prediction
        therefore carries its element epoch and a confidence grade (&lt;3 d high · &lt;7 d medium ·
        older low). Manoeuvres are unknown until new elements are published.
      </p>

      <div className="sec-label mt-10">Overpass ≠ observation ≠ acquisition</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" style={{ color: 'var(--text-2)' }}>
          <thead>
            <tr className="panel-label">
              <th className="hairline border-b py-2 pr-4">Term</th>
              <th className="hairline border-b py-2">Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="hairline border-b py-2 pr-4">Orbital overpass</td>
              <td className="hairline border-b py-2">
                The sub-satellite ground track passes within a chosen distance of the AOI. This is
                what the pass search computes.
              </td>
            </tr>
            <tr>
              <td className="hairline border-b py-2 pr-4">Potential observation opportunity</td>
              <td className="hairline border-b py-2">
                The AOI additionally falls inside a geometrically feasible imaging corridor (look
                side, incidence-angle range, swath). Only approximated where public sensor geometry
                exists, labelled “Estimated potential observation envelope”, and can be switched off
                (Phase 3).
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Confirmed SAR acquisition</td>
              <td className="py-2">
                The operator actually commanded and downlinked an image. Never claimed here — check
                the operator’s catalogue.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Disclaimer />
      </div>

      <div className="sec-label mt-10">Ascending &amp; descending passes</div>
      <p className="prose text-sm" style={{ color: 'var(--text-2)' }}>
        A pass is <strong>ascending</strong> when geodetic latitude is increasing (south → north)
        and <strong>descending</strong> otherwise. Sun-synchronous SAR missions see any location at
        roughly fixed local times in each direction, with different viewing geometries — which is
        why InSAR stacks never mix the two.
      </p>

      <div className="sec-label mt-10">How the pass search works</div>
      <ol className="prose list-decimal space-y-1 pl-5 text-sm" style={{ color: 'var(--text-2)' }}>
        <li>The AOI is reduced to representative points (centroid, vertices, edge midpoints).</li>
        <li>Each satellite’s sub-satellite point is scanned across the window (60–120 s grid).</li>
        <li>
          Great-circle distance to the nearest representative point is tracked; points inside a
          polygon AOI count as 0 km.
        </li>
        <li>Local minima under the distance threshold are refined to ≈1 s (golden-section).</li>
        <li>Direction and ground-track bearing are evaluated at closest approach.</li>
      </ol>
      <p className="prose mt-2 text-sm" style={{ color: 'var(--text-2)' }}>
        Distances are measured to the sub-satellite track, not to a sensor footprint.
      </p>

      <div className="sec-label mt-10">Updates</div>
      <p className="prose text-sm" style={{ color: 'var(--text-2)' }}>
        Orbit cache: 6-hourly (configurable, never more than hourly, per CelesTrak guidance).
        Registry: via pull requests — every entry carries a verification date. Corrections are
        welcome.
      </p>

      <footer className="site-foot mt-12">
        <span>© 2026 Pavan Muguda Sanjeevamurthy</span>
        <span className="foot-sep">·</span>
        <a
          className="foot-link"
          href="https://github.com/pmuguda/open-sar-orbits"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="gi" viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          Repo
        </a>
        <a
          className="foot-link kofi"
          href="https://ko-fi.com/pavan_muguda"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="gi" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M23.88 8.94c-.36-1.86-2.1-2.86-3.84-2.86h-.78V5.2c0-.66-.54-1.2-1.2-1.2H2.04C1.2 4 .6 4.66.6 5.46v8.7c0 2.94 2.4 5.34 5.34 5.34h6.18c2.7 0 4.92-1.98 5.28-4.56h.66c2.82 0 4.86-2.7 3.82-5.4zm-4.5 3.06h-.42V8.7h.54c.96 0 1.74.78 1.74 1.74-.06.9-.84 1.62-1.86 1.56zM7.74 14.7c-.18.06-.36-.06-.42-.18-1.14-1.5-3.18-3.06-3.18-5.16 0-1.86 2.1-2.64 3.42-1.08 1.32-1.56 3.42-.72 3.42 1.08 0 2.1-2.04 3.66-3.24 5.34z"
            />
          </svg>
          Support on Ko-fi
        </a>
      </footer>
    </div>
  );
}
