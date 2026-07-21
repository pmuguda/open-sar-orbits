# Satellite registry contribution guide

The curated registry lives in `backend/data/registry_seed.json` and is the
project's single source of truth for SAR mission/sensor metadata. It is loaded
into SQLite at backend startup.

## Golden rules

1. **Never invent values.** If a number is not publicly documented, use `null`
   (or `"unknown"` for enumerated string fields). The UI renders unknowns as `···`.
2. **Cite your source.** Every entry must set `metadata_source` (URL or short
   citation) and `metadata_last_verified` (ISO date you checked it).
3. **Prefer official sources**: agency/vendor mission pages, user guides,
   eoPortal. Avoid press releases and Wikipedia for numeric sensor specs.
4. NORAD IDs must come from an authoritative catalogue (CelesTrak, Space-Track).
   If you are unsure, leave `norad_catalog_id` null — the name-pattern fallback
   still enriches the satellite at constellation level.

## File structure

```json
{
  "version": 1,
  "constellations": [
    {
      "constellation": "ICEYE",
      "name_patterns": ["ICEYE"],
      "mission_name": "ICEYE X-band constellation",
      "operator": "ICEYE Ltd",
      "country": "Finland",
      "frequency_band": "X",
      "...": "defaults applied to any satellite whose OBJECT_NAME matches a pattern"
    }
  ],
  "satellites": [
    {
      "object_name": "SENTINEL-1A",
      "norad_catalog_id": 39634,
      "constellation": "Sentinel-1",
      "...": "full per-satellite record; overrides constellation defaults"
    }
  ]
}
```

Matching order for an orbital record: exact `norad_catalog_id` → first
constellation whose `name_patterns` entry is a case-insensitive prefix/substring
of `OBJECT_NAME` → unmatched (rendered with orbital data only).

## Fields

| Field | Type | Notes |
|-------|------|-------|
| `object_name` | string | As it appears in the CelesTrak catalogue |
| `norad_catalog_id` | int \| null | Primary join key |
| `international_designator` | string \| null | e.g. `2014-016A` |
| `mission_name` | string \| null | |
| `constellation` | string | Grouping key used by filters/legend |
| `operator` | string \| null | |
| `country` | string \| null | |
| `status` | `active` \| `inactive` \| `unknown` | Operational status, not orbital decay |
| `launch_date` | ISO date \| null | |
| `frequency_band` | `L` \| `S` \| `C` \| `X` \| `P` \| `Ku` \| `Ka` \| `L+S` \| null | `L+S` is for dual-band NISAR |
| `centre_frequency_ghz` | number \| null | |
| `polarisation_modes` | string[] \| null | e.g. `["VV", "VH"]`, `["quad"]` |
| `nominal_altitude_km` | number \| null | |
| `inclination_deg` | number \| null | Nominal (live value comes from OMM) |
| `repeat_cycle_days` | number \| null | |
| `look_direction` | `right` \| `left` \| `both` \| null | |
| `minimum_incidence_angle_deg` / `maximum_incidence_angle_deg` | number \| null | |
| `minimum_resolution_m` | number \| null | Finest publicly documented mode |
| `maximum_swath_width_km` | number \| null | Widest publicly documented mode |
| `open_data_available` | `yes` \| `no` \| `partial` \| `unknown` | |
| `archive_url` / `provider_url` / `documentation_url` | URL \| null | |
| `metadata_source` | string | **required** |
| `metadata_last_verified` | ISO date | **required** |

## CelesTrak name queries

The seed's top-level `celestrak_name_queries` array drives which satellites are
fetched at all: the backend issues one `NAME=<query>` GP request per entry and
keeps only records that match the registry (NORAD ID or name-pattern prefix).
When adding a mission with a new name family, add both a constellation entry
(with `name_patterns`) and a query term.

## Workflow

1. Edit `backend/data/registry_seed.json`.
2. `cd backend && pytest tests/test_registry.py` — schema validation runs in CI.
3. Open a PR describing the source of every changed value.
