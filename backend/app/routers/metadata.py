"""Service and cache status."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from .. import __version__

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


@router.get("/status")
def status(request: Request) -> dict[str, Any]:
    settings = request.app.state.settings
    return {
        "orbit_cache": request.app.state.cache.status(),
        "registry": request.app.state.registry.counts(),
        "service": {
            "version": __version__,
            "celestrak_url": settings.celestrak_url,
            "refresh_seconds": settings.refresh_seconds,
            "stale_after_hours": settings.stale_after_hours,
        },
    }
