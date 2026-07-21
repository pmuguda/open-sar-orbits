"""Merged satellite listing: orbit cache joined with the curated registry."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request

from ..passes import orbital_period_minutes

router = APIRouter(prefix="/api/satellites", tags=["satellites"])


def _merged_record(request: Request, record: dict[str, Any]) -> dict[str, Any]:
    registry = request.app.state.registry
    entry, match = registry.enrich(record.get("NORAD_CAT_ID"), record.get("OBJECT_NAME", ""))
    return {
        "norad_catalog_id": record.get("NORAD_CAT_ID"),
        "object_name": record.get("OBJECT_NAME"),
        "international_designator": (entry or {}).get("international_designator")
        or record.get("OBJECT_ID"),
        "epoch": record.get("EPOCH"),
        "inclination_deg": record.get("INCLINATION"),
        "period_minutes": orbital_period_minutes(record),
        "registry": entry,
        "registry_match": match,
    }


def _matches(item: dict[str, Any], key: str, expected: Optional[str]) -> bool:
    if expected is None:
        return True
    value = (item.get("registry") or {}).get(key)
    return value is not None and str(value).lower() == expected.lower()


@router.get("")
def list_satellites(
    request: Request,
    q: Optional[str] = None,
    constellation: Optional[str] = None,
    operator: Optional[str] = None,
    country: Optional[str] = None,
    frequency_band: Optional[str] = None,
    status: Optional[str] = None,
    open_data: Optional[str] = None,
) -> list[dict[str, Any]]:
    cache = request.app.state.cache.latest()
    if cache is None:
        return []
    items = [_merged_record(request, record) for record in cache.records]

    if q:
        needle = q.lower()
        items = [
            item
            for item in items
            if needle in (item["object_name"] or "").lower()
            or needle in str((item.get("registry") or {}).get("mission_name", "")).lower()
            or needle in str((item.get("registry") or {}).get("constellation", "")).lower()
        ]
    items = [i for i in items if _matches(i, "constellation", constellation)]
    items = [i for i in items if _matches(i, "operator", operator)]
    items = [i for i in items if _matches(i, "country", country)]
    items = [i for i in items if _matches(i, "frequency_band", frequency_band)]
    items = [i for i in items if _matches(i, "status", status)]
    items = [i for i in items if _matches(i, "open_data_available", open_data)]
    return items


@router.get("/{norad_id}")
def get_satellite(request: Request, norad_id: int) -> dict[str, Any]:
    cache = request.app.state.cache.latest()
    if cache is not None:
        for record in cache.records:
            if record.get("NORAD_CAT_ID") == norad_id:
                return _merged_record(request, record)

    # fall back to a registry-only view (no live orbit)
    registry = request.app.state.registry
    entry, match = registry.enrich(norad_id, "")
    if entry is None:
        raise HTTPException(status_code=404, detail=f"NORAD {norad_id} not found")
    return {
        "norad_catalog_id": norad_id,
        "object_name": entry.get("object_name"),
        "international_designator": entry.get("international_designator"),
        "epoch": None,
        "inclination_deg": entry.get("inclination_deg"),
        "period_minutes": None,
        "registry": entry,
        "registry_match": match,
    }
