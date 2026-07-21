# Architecture

## Overview

Open SAR Orbits is a two-service application:

| Service  | Stack                                   | Responsibility |
|----------|-----------------------------------------|----------------|
| backend  | Python 3.9+, FastAPI, SQLite, sgp4, httpx | CelesTrak OMM caching, curated SAR registry, AOI pass prediction |
| frontend | React 18, TypeScript, Vite, CesiumJS, satellite.js, Tailwind, zustand | 3D visualisation, client-side SGP4 sampling in a Web Worker, filtering, UI |

```
Browser ──► frontend (static, Vite build, served by nginx in Docker)
   │
   └──► backend REST API ──► SQLite (orbit cache + registry)
                     │
                     └──► CelesTrak GP endpoint (periodic, cached, stale-safe)
```

Design rules:

1. **CelesTrak is never hit from the browser.** Only the backend refresh task
   talks to CelesTrak, at a configurable interval (default 6 h, hard floor 1 h),
   and persists the last *valid* payload in SQLite so restarts and CelesTrak
   downtime do not lose data.
2. **Orbital data and curated metadata are separate.** OMM records are ephemeral
   and machine-fetched; the registry is human-curated and versioned in git
   (`backend/data/registry_seed.json`). They are joined at request/render time,
   primarily by NORAD catalogue ID, with a constellation name-pattern fallback.
3. **Propagation happens where it is cheapest.**
   - Frontend: satellite.js SGP4 inside a Web Worker produces sampled
     trajectories (default 90 min past → 180 min future, 30 s step). The main
     thread only builds Cesium `SampledPositionProperty` objects from the
     numeric buffers — no per-frame SGP4 on the UI thread, no recomputation per
     render. Windows are recomputed only when the clock approaches the buffer edge.
   - Backend: python-sgp4 for AOI pass search (coarse scan + local refinement),
     because multi-day × many-satellite scans do not belong in the browser.

## Backend modules

| Module | Purpose |
|--------|---------|
| `app/config.py`    | Env-driven settings (`CELESTRAK_URL`, `REFRESH_SECONDS`, `DB_PATH`, `STALE_AFTER_HOURS`, `CORS_ORIGINS`) |
| `app/db.py`        | SQLite connection management, schema bootstrap from `schema.sql` |
| `app/omm.py`       | Validation/normalisation of CelesTrak OMM JSON records |
| `app/celestrak.py` | `CelestrakCache`: fetch → validate → persist → serve; stale detection; failure fallback |
| `app/registry.py`  | Seed loading, NORAD join, constellation pattern matching |
| `app/geometry.py`  | GeoJSON validation, haversine, point-in-polygon, AOI representative points |
| `app/passes.py`    | SGP4 propagation, subpoint computation, closest-approach search, asc/desc classification |
| `app/routers/*`    | Thin HTTP layer over the above |

### Orbit cache lifecycle

```
startup ──► load latest cache row from SQLite (if any)
        ──► background task loop:
              if cache empty or older than REFRESH_SECONDS:
                  GET CelesTrak OMM JSON (timeout 30 s)
                  validate every record (app/omm.py) — reject empty/malformed payloads
                  insert new cache row (payload + fetched_at + record_count)
              sleep(check interval)
```

`GET /api/metadata/status` exposes `fetched_at`, `age_seconds`, `stale`
(age > `STALE_AFTER_HOURS`, default 24 h) and the frontend surfaces this in the
status strip ("CACHED · 3 H OLD" / "STALE DATA" chips).

## Frontend modules

| Module | Purpose |
|--------|---------|
| `src/api/client.ts`        | Typed fetch wrappers for the backend API |
| `src/lib/omm.ts`           | OMM record type + guards |
| `src/lib/propagation.ts`   | satellite.js wrappers: satrec init, geodetic state, period, asc/desc |
| `src/lib/constellations.ts`| Colour-blind-safe (Okabe–Ito) palette + glyph codes per constellation |
| `src/workers/orbitWorker.ts` | Batch trajectory sampling off the main thread |
| `src/store/appStore.ts`    | zustand store: filters, selection, layer toggles, theme, clock state |
| `src/components/GlobeView.tsx` | Imperative Cesium viewer + entity lifecycle |
| `src/components/…`         | Left panel (search/filters/layers), right panel (telemetry + registry), clock controls, legend, status strip |
| `src/views/…`              | Global · AOI (Phase 2 shell) · About |

### Cesium entity strategy (performance)

- One `Entity` per satellite: point + optional label, `position` =
  `SampledPositionProperty` filled from worker output (LINEAR interpolation,
  30 s samples).
- Orbit path uses Cesium `PathGraphics` (trail/lead time) — drawn from the same
  samples, so it is never recomputed per frame.
- Ground tracks are polylines built from the sampled subpoints; by default only
  the selected satellite shows its ground track/orbit (global toggles exist) to
  keep 150+ satellites smooth.
- Filter changes toggle `entity.show` instead of destroying entities.
- Trajectory windows refresh in the worker roughly every 30 min of simulated
  time, or when the user scrubs outside the buffered window.

## Data flow: AOI pass prediction (Phase 2 API, already implemented)

1. Frontend POSTs GeoJSON geometry + ISO time range (+ optional NORAD filter,
   max distance km) to `/api/passes`.
2. Backend validates geometry (rings closed, lon/lat ranges, vertex cap) and
   the window (≤ 31 days; evaluation budget guard).
3. For each satellite: coarse SGP4 scan (60–120 s step) of sub-satellite point
   distance to AOI representative points → local minima below threshold →
   golden-section refinement to ~1 s.
4. Response: closest approach time, min distance, asc/desc, approximate ground
   track bearing, element epoch, and a confidence grade derived from element age.

## Database schema

See [`backend/app/schema.sql`](../backend/app/schema.sql). Tables:

- `orbit_cache` — one row per successful CelesTrak fetch (latest wins):
  `id, fetched_at, source_url, record_count, payload_json`
- `constellations` — curated per-constellation defaults + `name_patterns`
  (JSON array of case-insensitive prefixes matched against `OBJECT_NAME`)
- `satellites` — curated per-satellite registry entries (all fields from the
  registry spec; `norad_catalog_id` unique when present)

The registry tables are rebuilt from `registry_seed.json` at startup, so git
remains the source of truth for curated data.
