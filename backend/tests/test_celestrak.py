from __future__ import annotations

import httpx

from app.celestrak import CelestrakCache


class CountingFetcher:
    def __init__(self, payload):
        self.payload = payload
        self.calls = 0

    def __call__(self):
        self.calls += 1
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


def test_refresh_stores_payload(db, settings, omm_payload):
    fetcher = CountingFetcher(omm_payload)
    cache = CelestrakCache(db, settings, fetcher=fetcher)
    entry = cache.refresh()
    assert entry is not None
    assert entry.record_count == 4
    assert fetcher.calls == 1


def test_refresh_respects_interval(db, settings, omm_payload):
    fetcher = CountingFetcher(omm_payload)
    cache = CelestrakCache(db, settings, fetcher=fetcher)
    cache.refresh()
    cache.refresh()  # fresh cache -> no second upstream call
    assert fetcher.calls == 1
    cache.refresh(force=True)
    assert fetcher.calls == 2


def test_failure_keeps_previous_cache(db, settings, omm_payload):
    good = CountingFetcher(omm_payload)
    cache = CelestrakCache(db, settings, fetcher=good)
    first = cache.refresh()

    cache.fetcher = CountingFetcher(httpx.ConnectError("celestrak down"))
    kept = cache.refresh(force=True)
    assert kept is not None
    assert kept.fetched_at == first.fetched_at


def test_malformed_payload_keeps_previous_cache(db, settings, omm_payload):
    cache = CelestrakCache(db, settings, fetcher=CountingFetcher(omm_payload))
    first = cache.refresh()

    cache.fetcher = CountingFetcher([])  # empty payload fails validation
    kept = cache.refresh(force=True)
    assert kept.fetched_at == first.fetched_at


def test_failure_with_no_cache_returns_none(db, settings):
    cache = CelestrakCache(db, settings, fetcher=CountingFetcher(httpx.ConnectError("down")))
    assert cache.refresh() is None
    assert cache.status()["stale"] is True


def test_stale_detection(db, settings, cache):
    assert cache.is_stale() is False
    # age the stored row beyond the stale threshold
    db.execute("UPDATE orbit_cache SET fetched_at = '2020-01-01T00:00:00+00:00'")
    cache._entry = None
    assert cache.is_stale() is True
    status = cache.status()
    assert status["stale"] is True
    assert status["record_count"] == 4


def test_persistence_across_instances(db, settings, cache):
    fresh = CelestrakCache(db, settings, fetcher=lambda: [])
    entry = fresh.latest()
    assert entry is not None
    assert entry.record_count == 4


def test_record_filter_drops_non_sar_records(db, settings, omm_payload):
    cache = CelestrakCache(
        db,
        settings,
        fetcher=CountingFetcher(omm_payload),
        record_filter=lambda r: r["OBJECT_NAME"] != "MYSTERY RADAR SAT",
    )
    entry = cache.refresh()
    assert entry.record_count == 3
    assert all(r["OBJECT_NAME"] != "MYSTERY RADAR SAT" for r in entry.records)


def test_fully_filtered_payload_keeps_previous_cache(db, settings, omm_payload, cache):
    first = cache.latest()
    strict = CelestrakCache(
        db,
        settings,
        fetcher=CountingFetcher(omm_payload),
        record_filter=lambda _r: False,
    )
    kept = strict.refresh(force=True)
    assert kept.fetched_at == first.fetched_at
