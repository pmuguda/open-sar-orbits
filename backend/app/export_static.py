"""Bake the API responses into static JSON files.

Used by the GitHub Pages workflow: a scheduled Action plays the role of the
caching backend — it fetches CelesTrak (NAME queries, validated, registry-
filtered), joins the curated registry, and writes orbits/satellites/status
JSON into the frontend's public/data directory. Browsers then load the
snapshot from Pages and still never talk to CelesTrak directly.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Optional

from . import __version__
from .celestrak import CelestrakCache, Fetcher
from .config import Settings
from .db import Database
from .registry import Registry, load_seed
from .routers.satellites import merge_record


def export_static(
    out_dir: str, settings: Optional[Settings] = None, fetcher: Optional[Fetcher] = None
) -> int:
    """Fetch, join and write the static snapshot. Returns the record count."""
    settings = settings or Settings(db_path=":memory:", refresh_enabled=False)
    db = Database(settings.db_path)
    load_seed(db, settings.registry_seed_path)
    registry = Registry(db)
    seed = json.loads(Path(settings.registry_seed_path).read_text())

    def is_sar_record(record: dict[str, Any]) -> bool:
        entry, _ = registry.enrich(record.get("NORAD_CAT_ID"), str(record.get("OBJECT_NAME", "")))
        return entry is not None

    cache = CelestrakCache(
        db,
        settings,
        fetcher=fetcher,
        name_queries=seed.get("celestrak_name_queries", []),
        record_filter=is_sar_record,
    )
    entry = cache.refresh(force=True)
    if entry is None:
        raise RuntimeError("CelesTrak fetch failed — nothing to export")

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    fetched_at = entry.fetched_at.isoformat().replace("+00:00", "Z")

    (out / "orbits.json").write_text(
        json.dumps(
            {
                "fetched_at": fetched_at,
                "age_seconds": 0,
                "stale": False,
                "source": settings.celestrak_url,
                "record_count": entry.record_count,
                "records": entry.records,
            }
        )
    )
    (out / "satellites.json").write_text(
        json.dumps([merge_record(registry, record) for record in entry.records])
    )
    (out / "status.json").write_text(
        json.dumps(
            {
                "orbit_cache": cache.status(),
                "registry": registry.counts(),
                "service": {
                    "version": __version__,
                    "celestrak_url": settings.celestrak_url,
                    "mode": "static-export",
                },
            }
        )
    )
    db.close()
    return entry.record_count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, help="output directory for the JSON snapshot")
    args = parser.parse_args()
    count = export_static(args.out)
    print(f"exported {count} OMM records to {args.out}")


if __name__ == "__main__":
    main()
