# API contract

Base URL: `http://localhost:8000` (Docker: service `backend`).
Interactive docs: `GET /docs` (Swagger UI) / `GET /redoc`.

All responses are JSON. Errors follow FastAPI convention:
`{"detail": "<message>"}` with appropriate 4xx/5xx status.

## GET /api/satellites

Merged view of the orbit cache and the curated registry.

Query params: `q` (name substring), `constellation`, `operator`, `country`,
`frequency_band`, `status`, `open_data` — all optional, exact match unless noted.

```json
[
  {
    "norad_catalog_id": 39634,
    "object_name": "SENTINEL-1A",
    "international_designator": "2014-016A",
    "epoch": "2026-07-20T14:11:29.000Z",
    "inclination_deg": 98.18,
    "period_minutes": 98.74,
    "registry": { "...curated fields, null when unknown..." },
    "registry_match": "norad" | "pattern" | null
  }
]
```

`registry_match` tells you whether curated metadata was joined by NORAD ID,
by constellation name-pattern (constellation-level defaults only), or not at all.

## GET /api/satellites/{norad_id}

Same shape, single object; 404 if the NORAD ID is in neither the orbit cache
nor the registry.

## GET /api/orbits/current

The full cached CelesTrak OMM payload plus cache metadata. The frontend
propagates from these records client-side.

```json
{
  "fetched_at": "2026-07-21T04:00:11Z",
  "age_seconds": 5023,
  "stale": false,
  "source": "https://celestrak.org/NORAD/elements/gp.php",
  "record_count": 143,
  "records": [ { "OBJECT_NAME": "...", "NORAD_CAT_ID": 39634, "EPOCH": "...", "MEAN_MOTION": ..., ... } ]
}
```

503 if no valid cache exists yet (first start with CelesTrak unreachable).

## GET /api/orbits/{norad_id}

Single OMM record with the same cache metadata; 404 if not in the cached group.

## POST /api/passes

Approximate orbital-pass search over an AOI. **This reports orbital proximity,
not imaging opportunities** — see [methodology.md](methodology.md).

Request:

```json
{
  "geometry": { "type": "Polygon", "coordinates": [[[lon, lat], ...]] },
  "start_time": "2026-07-21T00:00:00Z",
  "end_time": "2026-07-24T00:00:00Z",
  "satellite_ids": [39634, 43215],
  "maximum_distance_km": 500
}
```

- `geometry`: GeoJSON `Point` (with `maximum_distance_km` as the radius) or
  `Polygon` (first ring used; ≤ 256 vertices). Bounding boxes are polygons.
- Window ≤ 31 days; total evaluation budget is capped — narrow the window or
  pass `satellite_ids` if you hit 422.
- `satellite_ids` empty/omitted = all cached SAR satellites.

Response:

```json
{
  "aoi_summary": {"type": "Polygon", "representative_points": 9},
  "window": {"start": "...", "end": "..."},
  "disclaimer": "An orbital pass does not mean that the satellite acquired or can acquire imagery ...",
  "passes": [
    {
      "satellite_name": "SENTINEL-1A",
      "norad_catalog_id": 39634,
      "constellation": "Sentinel-1",
      "closest_approach_time": "2026-07-21T17:03:41Z",
      "minimum_distance_km": 112.4,
      "ascending_or_descending": "ascending",
      "approximate_ground_track_direction_deg": 347.9,
      "orbit_data_epoch": "2026-07-20T14:11:29Z",
      "prediction_confidence": "high" | "medium" | "low"
    }
  ]
}
```

`prediction_confidence` is derived from element age at the pass time:
< 3 days → high, < 7 days → medium, otherwise low.

## GET /api/metadata/status

```json
{
  "orbit_cache": {"fetched_at": "...", "age_seconds": 5023, "stale": false, "record_count": 143},
  "registry": {"satellite_count": 24, "constellation_count": 18, "last_verified_max": "2026-07-21"},
  "service": {"version": "0.1.0", "celestrak_url": "..."}
}
```

## GET /api/health

Liveness probe: `{"status": "ok"}`.
