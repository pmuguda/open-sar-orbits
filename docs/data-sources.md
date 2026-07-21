# Data sources

## Orbital elements — CelesTrak

- Endpoint: `https://celestrak.org/NORAD/elements/gp.php?NAME=<query>&FORMAT=JSON`,
  one query per SAR mission family (`SENTINEL-1`, `ICEYE`, `TERRASAR`, …), curated
  in `backend/data/registry_seed.json` under `celestrak_name_queries`. Results are
  merged, deduplicated by NORAD ID, and filtered against the registry so only
  SAR-relevant records are cached. (CelesTrak's `GROUP=radar` is the radar
  *calibration* group — CALSPHERE spheres, not SAR imagers — hence the NAME queries.)
- Format: OMM (CCSDS Orbit Mean-Elements Message) as JSON — preferred over
  legacy TLE (no line-format parsing, explicit field names, full precision).
- Fetch policy: **backend only**, default every 6 h (`REFRESH_SECONDS=21600`),
  hard floor 1 h, with a politeness delay between queries, respecting
  CelesTrak's guidance against frequent GP polling. The last valid payload is
  persisted in SQLite and served during CelesTrak downtime; the UI labels cache
  age and staleness. A partially failed multi-query fetch never replaces a
  complete cache.
- Validation: every record must carry a parsable `EPOCH`, numeric mean elements
  within physical ranges, and a positive `NORAD_CAT_ID`; payloads that fail
  validation are rejected and the previous cache is kept.
- New SAR missions need both a registry entry and (if a new name family) a
  `celestrak_name_queries` entry — see the registry guide.

## Curated SAR registry

`backend/data/registry_seed.json` — see [registry-guide.md](registry-guide.md)
for the field-by-field contribution guide. Sources used for the seed:

- ESA / Copernicus mission pages (Sentinel-1)
- CSA (RADARSAT-2, RCM), MDA
- DLR / Airbus (TerraSAR-X, TanDEM-X), Hisdesat (PAZ)
- ASI / e-GEOS (COSMO-SkyMed, CSG)
- CONAE (SAOCOM), JAXA (ALOS-2, ALOS-4), ISRO (RISAT / EOS), KARI (KOMPSAT-5)
- Vendor documentation: ICEYE, Capella Space, Umbra, Synspective (StriX), iQPS
- eoPortal satellite mission directory

Values that are not publicly documented (typical for commercial constellations)
are `null` / `"unknown"` — the application renders them as `···`. Per-satellite
`archive_url` / `provider_url` / `documentation_url` fields link to the official
mission pages shown in the satellite detail panel.

## Imagery / basemap

The Cesium globe uses the offline **Natural Earth II** imagery bundled with
CesiumJS (no Cesium Ion token, no external tile requests) plus Cesium's
day/night lighting. Higher-resolution basemaps can be configured by the user.
