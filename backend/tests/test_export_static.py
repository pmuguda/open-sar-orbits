from __future__ import annotations

import json

import pytest

from app.export_static import export_static


def test_export_static_writes_snapshot(tmp_path, settings, omm_payload):
    out = tmp_path / "data"
    count = export_static(str(out), settings=settings, fetcher=lambda: omm_payload)

    # MYSTERY RADAR SAT has no registry match and must be filtered out
    assert count == 3

    orbits = json.loads((out / "orbits.json").read_text())
    assert orbits["record_count"] == 3
    assert orbits["stale"] is False
    assert {r["OBJECT_NAME"] for r in orbits["records"]} == {
        "SENTINEL-1A",
        "TERRASAR-X",
        "ICEYE-X99",
    }

    satellites = json.loads((out / "satellites.json").read_text())
    by_id = {s["norad_catalog_id"]: s for s in satellites}
    assert by_id[39634]["registry"]["frequency_band"] == "C"
    assert by_id[99001]["registry_match"] == "pattern"

    status = json.loads((out / "status.json").read_text())
    assert status["service"]["mode"] == "static-export"
    assert status["orbit_cache"]["record_count"] == 3


def test_export_static_fails_without_data(tmp_path, settings):
    def broken_fetcher():
        raise ValueError("celestrak down")

    with pytest.raises(RuntimeError):
        export_static(str(tmp_path / "data2"), settings=settings, fetcher=broken_fetcher)
