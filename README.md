# Open SAR Orbits — Open SAR Constellation Explorer

An open-source, interactive 3D dashboard that visualises the orbits of publicly
catalogued **Synthetic Aperture Radar (SAR)** satellites and helps you answer:

> **Which SAR satellites can potentially observe a selected area, and when will
> they pass nearby?**

More than a generic satellite tracker, it combines:

1. SAR satellite orbit visualisation (CesiumJS 3D globe)
2. Curated SAR mission and sensor metadata
3. Area-of-interest (AOI) pass prediction
4. Ground-track visualisation

![screenshot placeholder](docs/screenshots/global-view.png)
*Screenshots / demo GIF: see [docs/screenshots](docs/screenshots/).*

## Who is this for?

- SAR researchers and InSAR practitioners
- Earth-observation analysts
- Students learning radar remote sensing and orbital mechanics
- Disaster-response analysts looking for the next possible SAR pass
- Mission-comparison studies (band, resolution, swath, revisit)

## Important disclaimer

> **An orbital pass does not mean that the satellite acquired or can acquire
> imagery of the AOI.** Actual SAR imaging depends on spacecraft attitude, look
> direction, incidence-angle limits, acquisition mode, operator scheduling,
> tasking constraints and data availability. This tool distinguishes between an
> *orbital overpass*, a *potential observation opportunity* and a *confirmed SAR
> acquisition* — it never claims the latter. See
> [docs/methodology.md](docs/methodology.md).

## Architecture at a glance

```
┌────────────────────────┐        ┌──────────────────────────────┐
│  Frontend (React + TS) │  HTTP  │  Backend (FastAPI + SQLite)  │   6-hourly
│  Vite · CesiumJS globe │ ─────► │  /api/orbits  /api/satellites │ ─────────►  CelesTrak
│  satellite.js + Worker │        │  /api/passes  /api/metadata   │  OMM JSON   (GP data)
│  Tailwind · SAR Console│        │  cache · registry · passes    │
└────────────────────────┘        └──────────────────────────────┘
```

- **Orbital data**: CelesTrak general-perturbation elements (OMM JSON), fetched by a
  **backend caching service** — never directly from each browser session. CelesTrak has
  no "SAR" group (`GROUP=radar` is radar *calibration* targets), so the backend issues
  one `NAME=` query per SAR mission family (curated in the registry seed), merges and
  dedupes the results, and filters them against the registry. The last valid response
  keeps serving if CelesTrak is temporarily unavailable, and the UI states clearly when
  cached/stale data is in use.
- **Registry**: a curated, human-maintained SAR mission/sensor metadata registry
  (JSON seed → SQLite), joined to orbital records primarily by **NORAD catalogue ID**,
  with constellation name-pattern fallback. Unknown values are `null` — nothing is invented.
- **Propagation**: SGP4 via [satellite.js](https://github.com/shashwatak/satellite-js)
  in a **Web Worker** on the frontend (smooth UI for 150+ satellites), and via
  [python-sgp4](https://pypi.org/project/sgp4/) on the backend for pass prediction.

Full details: [docs/architecture.md](docs/architecture.md) ·
[docs/api.md](docs/api.md) · [docs/data-sources.md](docs/data-sources.md)

## Quick start (Docker)

```bash
git clone https://github.com/pmuguda/open-sar-orbits.git
cd open-sar-orbits
docker compose up --build
# frontend → http://localhost:5173   backend → http://localhost:8000/docs
```

## Local development

### Backend (Python 3.9+)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Lint / type-check / test:

```bash
ruff check app tests && black --check app tests && mypy app
pytest
```

### Frontend (Node 20+)

```bash
cd frontend
npm install
VITE_API_BASE=http://localhost:8000 npm run dev   # http://localhost:5173
```

Lint / test / build:

```bash
npm run lint && npm run test && npm run build
```

## Repository structure

```
open-sar-orbits/
├── backend/                 # FastAPI service
│   ├── app/
│   │   ├── main.py          # app factory, startup refresh task
│   │   ├── config.py        # env-driven settings
│   │   ├── db.py            # SQLite access + schema bootstrap
│   │   ├── schema.sql       # database schema
│   │   ├── omm.py           # CelesTrak OMM JSON validation/parsing
│   │   ├── celestrak.py     # caching fetch service (stale-safe)
│   │   ├── registry.py      # curated SAR registry + orbit join
│   │   ├── geometry.py      # GeoJSON validation, great-circle maths
│   │   ├── passes.py        # SGP4 AOI pass prediction
│   │   └── routers/         # API endpoints
│   ├── data/registry_seed.json
│   └── tests/               # pytest + offline fixtures
├── frontend/                # React + TypeScript + Vite
│   └── src/
│       ├── api/             # typed API client
│       ├── lib/             # OMM types, propagation, constellation palette
│       ├── workers/         # SGP4 trajectory sampling off the main thread
│       ├── store/           # zustand app state (filters, selection, layers)
│       ├── components/      # globe, panels, clock, legend, telemetry strip
│       └── views/           # Global · AOI · About
├── docs/                    # architecture, API, methodology, data sources
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Features (Phase 1 — MVP)

- CesiumJS globe with day/night lighting, time animation, camera tracking
- Live SAR satellite positions from cached CelesTrak OMM data
- Orbit paths (past/future segments) and ground tracks
- Satellite selection with a full telemetry + sensor metadata panel
- Search and filters: constellation, operator, country, band, status, open data
- Label / orbit / ground-track layer toggles, colour-blind-safe legend
- About & methodology view

### Roadmap

- **Phase 2 — AOI analysis**: AOI drawing, GeoJSON import, pass prediction UI,
  results table + timeline, CSV/GeoJSON export (backend `/api/passes` already works)
- **Phase 3 — SAR intelligence**: estimated observation envelopes, mission comparison

## Known limitations

See [docs/limitations.md](docs/limitations.md) for the complete list. Highlights:

- SGP4/GP element accuracy degrades with element age (km-level at epoch, tens of
  km after several days); pass times are approximate.
- Pass prediction reports **orbital proximity**, not imaging opportunities.
- The registry only contains publicly documented values; commercial constellations
  publish little — many fields are deliberately `null`.

## Data sources & credits

- Orbital elements: [CelesTrak](https://celestrak.org) (Dr. T.S. Kelso) — cached
  server-side, respecting their guidance against high-frequency polling.
- Registry metadata: official mission pages (ESA, CSA, DLR, ASI, CONAE, JAXA, ISRO,
  vendors) — every entry carries `metadata_source` and `metadata_last_verified`.
- Globe: [CesiumJS](https://cesium.com/platform/cesiumjs/) with offline Natural
  Earth II imagery (no Ion token required).

## Contributing

Registry corrections are especially welcome — see
[docs/registry-guide.md](docs/registry-guide.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 Pavan Muguda Sanjeevamurthy
