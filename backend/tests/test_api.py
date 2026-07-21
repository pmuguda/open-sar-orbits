from __future__ import annotations

from datetime import datetime, timedelta, timezone

EPOCH = datetime(2026, 7, 20, 12, 0, 0, tzinfo=timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_list_satellites(client):
    items = client.get("/api/satellites").json()
    assert len(items) == 4
    by_id = {i["norad_catalog_id"]: i for i in items}
    assert by_id[39634]["registry_match"] == "norad"
    assert by_id[39634]["registry"]["frequency_band"] == "C"
    assert by_id[99001]["registry_match"] == "pattern"
    assert by_id[99002]["registry"] is None
    assert by_id[39634]["period_minutes"] is not None


def test_satellite_filters(client):
    items = client.get("/api/satellites", params={"constellation": "Sentinel-1"}).json()
    assert [i["norad_catalog_id"] for i in items] == [39634]

    items = client.get("/api/satellites", params={"q": "iceye"}).json()
    assert [i["norad_catalog_id"] for i in items] == [99001]

    items = client.get("/api/satellites", params={"frequency_band": "X"}).json()
    assert {i["norad_catalog_id"] for i in items} == {31698, 99001}

    items = client.get("/api/satellites", params={"open_data": "yes"}).json()
    assert {i["norad_catalog_id"] for i in items} == {39634}


def test_get_satellite_detail(client):
    item = client.get("/api/satellites/39634").json()
    assert item["object_name"] == "SENTINEL-1A"
    assert item["registry"]["operator"].startswith("ESA")

    # registry-only fallback (satellite in the registry but not in the cached group)
    item = client.get("/api/satellites/43215").json()
    assert item["registry"]["constellation"] == "PAZ"
    assert item["epoch"] is None

    assert client.get("/api/satellites/1").status_code == 404


def test_orbits_endpoints(client):
    payload = client.get("/api/orbits/current").json()
    assert payload["record_count"] == 4
    assert payload["stale"] is False
    assert len(payload["records"]) == 4

    single = client.get("/api/orbits/31698").json()
    assert single["record"]["OBJECT_NAME"] == "TERRASAR-X"

    assert client.get("/api/orbits/424242").status_code == 404


def test_metadata_status(client):
    status = client.get("/api/metadata/status").json()
    assert status["orbit_cache"]["record_count"] == 4
    assert status["registry"]["satellite_count"] >= 20
    assert "celestrak_url" in status["service"]


def test_passes_endpoint(client):
    body = {
        "geometry": {"type": "Point", "coordinates": [36.82, -1.29]},
        "start_time": _iso(EPOCH),
        "end_time": _iso(EPOCH + timedelta(hours=24)),
        "satellite_ids": [39634],
        "maximum_distance_km": 2000,
    }
    payload = client.post("/api/passes", json=body).json()
    assert payload["disclaimer"].startswith("An orbital pass does not mean")
    assert payload["passes"]
    first = payload["passes"][0]
    assert first["satellite_name"] == "SENTINEL-1A"
    assert first["constellation"] == "Sentinel-1"
    assert first["prediction_confidence"] in {"high", "medium", "low"}


def test_passes_invalid_geometry(client):
    body = {
        "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1]]]},
        "start_time": _iso(EPOCH),
        "end_time": _iso(EPOCH + timedelta(hours=24)),
    }
    response = client.post("/api/passes", json=body)
    assert response.status_code == 422
    assert "geometry" in response.json()["detail"].lower()


def test_passes_window_limits(client):
    body = {
        "geometry": {"type": "Point", "coordinates": [0, 0]},
        "start_time": _iso(EPOCH),
        "end_time": _iso(EPOCH + timedelta(days=40)),
    }
    assert client.post("/api/passes", json=body).status_code == 422

    body["end_time"] = _iso(EPOCH - timedelta(hours=1))  # end before start
    assert client.post("/api/passes", json=body).status_code == 422


def test_passes_unknown_satellite_ids(client):
    body = {
        "geometry": {"type": "Point", "coordinates": [0, 0]},
        "start_time": _iso(EPOCH),
        "end_time": _iso(EPOCH + timedelta(hours=6)),
        "satellite_ids": [123456],
    }
    assert client.post("/api/passes", json=body).status_code == 404
