# Known limitations

## Orbital data & propagation

- SGP4 with GP mean elements is accurate to ~1–3 km at epoch, degrading with
  element age; pass timing can drift seconds→minutes over a week. Confidence
  grades and element epochs are always displayed.
- The satellite set is defined by curated CelesTrak `NAME=` queries plus the
  registry filter: brand-new missions (or renamed objects) are missing until a
  query/registry entry is added, and classified/uncatalogued objects never appear.
- No manoeuvre knowledge: post-manoeuvre predictions are wrong until new
  elements are published.
- Decayed/inactive satellites can still appear if they remain in the group;
  registry `status` is the curated signal.

## Pass prediction

- Distance is measured to the **sub-satellite ground track**, not to a sensor
  footprint; `maximum_distance_km` is a proximity gate, not an access mask.
- An overpass ≠ observation ≠ acquisition (see methodology). No tasking,
  attitude, duty-cycle, conflict or downlink constraints are modelled.
- Coarse-scan step (60–120 s) can in principle skip a very short-lived minimum
  for extremely tight thresholds; refinement mitigates but does not eliminate this.
- Long windows (> 7 days) with many satellites are computationally capped; the
  API asks you to narrow the request rather than silently degrade.

## Registry

- Commercial operators publish little; many fields are intentionally `null`.
- Values are verified on `metadata_last_verified` dates and can go stale.
- Constellation-level pattern matching applies fleet-wide defaults that may not
  hold for individual spacecraft (e.g. per-satellite status).

## Frontend

- Requires WebGL2; a clear error is shown when unavailable.
- Bundled Natural Earth II imagery is low-resolution by design (offline, no
  tokens); it is a context map, not a basemap for analysis.
- Trajectory sampling (30 s, linear interpolation) can visibly cut corners at
  very high animation multipliers.
