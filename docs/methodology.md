# Methodology and limitations

This page mirrors the in-app **About** view.

## Data sources

- **Orbital elements** — [CelesTrak](https://celestrak.org) general-perturbation
  (GP) element sets in OMM (Orbit Mean-Elements Message) JSON format, collected
  with one `NAME=` query per SAR mission family (curated in the registry seed),
  merged, deduplicated by NORAD ID, and filtered against the registry. The
  backend caches these (default refresh every 6 hours) and keeps serving the
  last valid set if CelesTrak is unavailable. The UI always shows the fetch time
  and flags stale data (> 24 h old).
- **Mission/sensor metadata** — a curated registry maintained in this repository,
  compiled only from public sources (agency mission pages, vendor documentation,
  eoPortal). Every entry records `metadata_source` and `metadata_last_verified`.
  Where a value is not publicly documented it is `null` — never guessed.

## SGP4 propagation

Positions are computed with the standard SGP4 analytical propagator from mean
elements (satellite.js in the browser, python-sgp4 on the server). SGP4 yields
positions in the TEME inertial frame, converted to Earth-fixed coordinates via
Greenwich Mean Sidereal Time, then to geodetic latitude/longitude/altitude
(WGS-84).

**Accuracy**: roughly 1–3 km near the element epoch, degrading by a few km per
day of element age. Predicted pass times drift accordingly (typically seconds
to a couple of minutes within a week of epoch). This is why each prediction
carries the element epoch and a confidence grade (element age < 3 d → high,
< 7 d → medium, else low), and why elements are refreshed continuously.

## Overpass vs. observation vs. acquisition

| Term | Meaning | What this tool shows |
|------|---------|----------------------|
| **Orbital overpass** | The sub-satellite ground track passes within a chosen distance of the AOI | ✅ computed |
| **Potential observation opportunity** | The AOI additionally falls inside a *geometrically feasible* imaging corridor (look side, incidence-angle range, swath) | ⚠ approximated only when public sensor geometry exists; labelled "Estimated potential observation envelope", off-switchable |
| **Confirmed SAR acquisition** | The operator actually commanded and downlinked an image | ❌ never claimed — check the provider archive |

> **Disclaimer** — An orbital pass does not mean that the satellite acquired or
> can acquire imagery of the AOI. Actual SAR imaging depends on spacecraft
> attitude, look direction, incidence-angle limits, acquisition mode, operator
> scheduling, tasking constraints and data availability.

## Ascending vs. descending

A satellite is on an **ascending** pass when its geodetic latitude is
increasing (moving south → north, node crossing on the equator), **descending**
when decreasing. For sun-synchronous SAR missions the two directions occur at
roughly fixed local times (e.g. Sentinel-1: ~18:00 ascending / ~06:00
descending local solar time) and produce different viewing geometries — which
is why InSAR stacks never mix them.

## How pass prediction works

1. The AOI is reduced to representative points (centroid, vertices, edge
   midpoints; a point AOI is itself).
2. Each satellite's sub-satellite point is propagated across the window on a
   coarse grid (60–120 s).
3. Great-circle distance (haversine, mean Earth radius) from the subpoint to
   the nearest representative point is tracked; a point inside the polygon
   counts as 0 km.
4. Local minima below `maximum_distance_km` are refined by golden-section
   search to ≈ 1 s resolution.
5. Ascending/descending and the ground-track bearing are evaluated at closest
   approach.

Note the distance is measured to the **sub-satellite track**, not to any sensor
footprint. A 500 km threshold generously covers the access region of wide-swath
modes; narrow spotlight modes have far stricter geometry.

## How estimated observation envelopes are calculated (Phase 3)

Where look direction, incidence-angle limits and nominal altitude are publicly
documented, the potential imaging corridor is approximated as the ground strip
offset to the look side of the track between
`ground_offset(min_incidence)` and `ground_offset(max_incidence)` (spherical
Earth, nadir offset ≈ Re·(asin(sin(i)·(Re+h)/Re) − i)). It ignores attitude
manoeuvres, mode-specific swath positioning and scheduling — it is an
*envelope*, not a footprint, and can be switched off.

## Update cadence

- Orbit cache: every 6 h by default (configurable; never more than hourly).
- Registry: manually, via pull requests; each entry carries its verification date.
