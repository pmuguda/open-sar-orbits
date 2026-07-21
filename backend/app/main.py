"""FastAPI application factory."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .celestrak import CelestrakCache
from .config import Settings, get_settings
from .db import Database
from .registry import Registry, load_seed
from .routers import metadata, orbits, passes, satellites

logger = logging.getLogger(__name__)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()
    db = Database(settings.db_path)
    load_seed(db, settings.registry_seed_path)
    registry = Registry(db)

    seed = json.loads(Path(settings.registry_seed_path).read_text())
    name_queries: list[str] = seed.get("celestrak_name_queries", [])

    def is_sar_record(record: dict[str, Any]) -> bool:
        entry, _ = registry.enrich(record.get("NORAD_CAT_ID"), str(record.get("OBJECT_NAME", "")))
        return entry is not None

    cache = CelestrakCache(db, settings, name_queries=name_queries, record_filter=is_sar_record)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        task: Optional[asyncio.Task] = None
        if settings.refresh_enabled:
            task = asyncio.create_task(_refresh_loop(cache, settings))
        yield
        if task is not None:
            task.cancel()
        db.close()

    app = FastAPI(
        title="Open SAR Orbits API",
        version=__version__,
        description="Cached CelesTrak SAR orbital data, curated mission registry "
        "and AOI pass prediction.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.db = db
    app.state.registry = registry
    app.state.cache = cache

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(satellites.router)
    app.include_router(orbits.router)
    app.include_router(passes.router)
    app.include_router(metadata.router)

    @app.get("/api/health", tags=["metadata"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


async def _refresh_loop(cache: CelestrakCache, settings: Settings) -> None:
    while True:
        try:
            await asyncio.to_thread(cache.refresh)
        except Exception:  # pragma: no cover - defensive, refresh() already guards
            logger.exception("unexpected error in CelesTrak refresh loop")
        await asyncio.sleep(settings.refresh_check_seconds)


app = create_app()
