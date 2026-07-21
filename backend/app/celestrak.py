"""CelesTrak caching fetch service.

Only this service ever talks to CelesTrak. It stores every valid payload in
SQLite so restarts and CelesTrak downtime keep serving the last good data, and
it refuses to poll more often than the configured interval.

CelesTrak has no "SAR" group (GROUP=radar is radar *calibration* targets), so
SAR satellites are collected with one NAME= query per mission family (curated
in the registry seed), merged and deduplicated by NORAD ID, then filtered
against the registry so only SAR-relevant records are cached.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import httpx

from .config import Settings
from .db import Database
from .omm import OmmValidationError, parse_payload

logger = logging.getLogger(__name__)

Fetcher = Callable[[], Any]
RecordFilter = Callable[[dict[str, Any]], bool]

_QUERY_PAUSE_S = 0.5  # politeness delay between NAME queries


@dataclass
class CacheEntry:
    fetched_at: datetime
    source_url: str
    record_count: int
    records: list[dict[str, Any]]

    @property
    def age_seconds(self) -> float:
        return (datetime.now(timezone.utc) - self.fetched_at).total_seconds()


class NoCacheError(RuntimeError):
    """No valid orbital data has ever been cached."""


class CelestrakCache:
    def __init__(
        self,
        db: Database,
        settings: Settings,
        fetcher: Optional[Fetcher] = None,
        name_queries: Optional[list[str]] = None,
        record_filter: Optional[RecordFilter] = None,
    ):
        self.db = db
        self.settings = settings
        self.fetcher = fetcher or self._default_fetcher
        self.name_queries = name_queries or []
        self.record_filter = record_filter
        self._entry: Optional[CacheEntry] = None

    def _fetch_one(self, client: httpx.Client, name: str) -> list[Any]:
        response = client.get(self.settings.celestrak_url, params={"NAME": name, "FORMAT": "JSON"})
        # CelesTrak answers a no-match NAME query with 404 + "No GP data found"
        # (plain text) — that is an empty result, not a failure
        if "no gp data" in response.text.lower():
            return []
        response.raise_for_status()
        try:
            payload = response.json()
        except ValueError:
            return []
        return payload if isinstance(payload, list) else []

    def _default_fetcher(self) -> Any:
        """Merge one NAME query per SAR mission family, deduplicated by NORAD ID.

        Any failed query aborts the whole refresh so a partial result never
        replaces a complete cache.
        """
        merged: dict[Any, Any] = {}
        with httpx.Client(
            timeout=self.settings.http_timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "open-sar-orbits (github.com/pmuguda/open-sar-orbits)"},
        ) as client:
            for index, name in enumerate(self.name_queries):
                if index:
                    time.sleep(_QUERY_PAUSE_S)
                for record in self._fetch_one(client, name):
                    if isinstance(record, dict) and record.get("NORAD_CAT_ID") is not None:
                        merged[record["NORAD_CAT_ID"]] = record
        return list(merged.values())

    def latest(self) -> Optional[CacheEntry]:
        if self._entry is not None:
            return self._entry
        row = self.db.query_one(
            "SELECT fetched_at, source_url, record_count, payload_json"
            " FROM orbit_cache ORDER BY id DESC LIMIT 1"
        )
        if row is None:
            return None
        self._entry = CacheEntry(
            fetched_at=datetime.fromisoformat(row["fetched_at"]),
            source_url=row["source_url"],
            record_count=row["record_count"],
            records=json.loads(row["payload_json"]),
        )
        return self._entry

    def store(self, records: list[dict[str, Any]]) -> CacheEntry:
        entry = CacheEntry(
            fetched_at=datetime.now(timezone.utc),
            source_url=self.settings.celestrak_url,
            record_count=len(records),
            records=records,
        )
        self.db.execute(
            "INSERT INTO orbit_cache (fetched_at, source_url, record_count, payload_json)"
            " VALUES (?, ?, ?, ?)",
            (
                entry.fetched_at.isoformat(),
                entry.source_url,
                entry.record_count,
                json.dumps(records),
            ),
        )
        # keep a short history only
        self.db.execute(
            "DELETE FROM orbit_cache WHERE id NOT IN"
            " (SELECT id FROM orbit_cache ORDER BY id DESC LIMIT 5)"
        )
        self._entry = entry
        return entry

    def refresh(self, force: bool = False) -> Optional[CacheEntry]:
        """Fetch from CelesTrak if the cache is missing or old enough.

        Never raises on upstream failure: the last valid entry (possibly None)
        is returned and the problem is logged.
        """
        current = self.latest()
        if (
            not force
            and current is not None
            and current.age_seconds < self.settings.refresh_seconds
        ):
            return current

        try:
            payload = self.fetcher()
            records, dropped = parse_payload(payload)
        except (httpx.HTTPError, OmmValidationError, ValueError) as exc:
            logger.warning("CelesTrak refresh failed, keeping previous cache: %s", exc)
            return current

        if dropped:
            logger.info("dropped %d invalid OMM records: %s", len(dropped), dropped[:5])
        if self.record_filter is not None:
            before = len(records)
            records = [r for r in records if self.record_filter(r)]
            if len(records) < before:
                logger.info("filtered %d non-SAR records from the fetch", before - len(records))
            if not records:
                logger.warning("all fetched records were filtered out; keeping previous cache")
                return current
        entry = self.store(records)
        logger.info("cached %d OMM records from CelesTrak", entry.record_count)
        return entry

    def is_stale(self, entry: Optional[CacheEntry] = None) -> bool:
        entry = entry or self.latest()
        if entry is None:
            return True
        return entry.age_seconds > self.settings.stale_after_hours * 3600

    def status(self) -> dict[str, Any]:
        entry = self.latest()
        if entry is None:
            return {"fetched_at": None, "age_seconds": None, "stale": True, "record_count": 0}
        return {
            "fetched_at": entry.fetched_at.isoformat().replace("+00:00", "Z"),
            "age_seconds": round(entry.age_seconds, 1),
            "stale": self.is_stale(entry),
            "record_count": entry.record_count,
        }
