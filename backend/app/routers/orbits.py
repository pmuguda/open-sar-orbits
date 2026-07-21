"""Raw cached OMM data for client-side propagation."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/orbits", tags=["orbits"])


def _cache_or_503(request: Request) -> Any:
    cache = request.app.state.cache
    entry = cache.latest()
    if entry is None:
        raise HTTPException(
            status_code=503,
            detail="No orbital data cached yet — CelesTrak has not been reachable.",
        )
    return cache, entry


@router.get("/current")
def current_orbits(request: Request) -> dict[str, Any]:
    cache, entry = _cache_or_503(request)
    return {
        "fetched_at": entry.fetched_at.isoformat().replace("+00:00", "Z"),
        "age_seconds": round(entry.age_seconds, 1),
        "stale": cache.is_stale(entry),
        "source": entry.source_url,
        "record_count": entry.record_count,
        "records": entry.records,
    }


@router.get("/{norad_id}")
def orbit_by_id(request: Request, norad_id: int) -> dict[str, Any]:
    cache, entry = _cache_or_503(request)
    for record in entry.records:
        if record.get("NORAD_CAT_ID") == norad_id:
            return {
                "fetched_at": entry.fetched_at.isoformat().replace("+00:00", "Z"),
                "stale": cache.is_stale(entry),
                "record": record,
            }
    raise HTTPException(status_code=404, detail=f"NORAD {norad_id} not in the cached radar group")
