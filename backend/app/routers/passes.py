"""AOI pass prediction endpoint."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..geometry import GeometryError, validate_geometry
from ..passes import DISCLAIMER, PassPredictionError, predict_passes
from ..schemas import PassRequest

router = APIRouter(prefix="/api/passes", tags=["passes"])


@router.post("")
def compute_passes(request: Request, body: PassRequest) -> dict[str, Any]:
    settings = request.app.state.settings
    cache_entry = request.app.state.cache.latest()
    if cache_entry is None:
        raise HTTPException(status_code=503, detail="No orbital data cached yet.")

    try:
        aoi = validate_geometry(body.geometry)
    except GeometryError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid AOI geometry: {exc}") from exc

    window_days = (body.end_time - body.start_time).total_seconds() / 86400.0
    if window_days > settings.max_pass_window_days:
        raise HTTPException(
            status_code=422,
            detail=f"Prediction window exceeds {settings.max_pass_window_days} days",
        )

    records = cache_entry.records
    if body.satellite_ids:
        wanted = set(body.satellite_ids)
        records = [r for r in records if r.get("NORAD_CAT_ID") in wanted]
        if not records:
            raise HTTPException(
                status_code=404, detail="None of the requested satellite_ids are in the cache"
            )

    try:
        results, skipped = predict_passes(
            records,
            aoi,
            body.start_time,
            body.end_time,
            body.maximum_distance_km,
            max_evaluations=settings.max_pass_evaluations,
        )
    except PassPredictionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    registry = request.app.state.registry
    passes = []
    for result in results:
        item = result.to_dict()
        entry, _ = registry.enrich(result.norad_catalog_id, result.satellite_name)
        item["constellation"] = (entry or {}).get("constellation")
        passes.append(item)

    return {
        "aoi_summary": {"type": aoi.kind, "representative_points": len(aoi.representative)},
        "window": {
            "start": body.start_time.isoformat(),
            "end": body.end_time.isoformat(),
        },
        "orbit_data": {
            "fetched_at": cache_entry.fetched_at.isoformat().replace("+00:00", "Z"),
            "stale": request.app.state.cache.is_stale(cache_entry),
        },
        "disclaimer": DISCLAIMER,
        "passes": passes,
        "skipped_satellites": skipped,
    }
