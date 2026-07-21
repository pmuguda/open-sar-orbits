from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.geometry import validate_geometry
from app.omm import parse_payload
from app.passes import (
    PassPredictionError,
    orbital_period_minutes,
    predict_passes,
    satrec_from_omm,
    subpoint,
)

EPOCH = datetime(2026, 7, 20, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def records(omm_payload):
    parsed, _ = parse_payload(omm_payload)
    return parsed


def test_propagation_sanity(records):
    sat = satrec_from_omm(records[0])  # SENTINEL-1A-like, ~700 km SSO
    lat, lon, alt = subpoint(sat, EPOCH)
    assert -90.0 <= lat <= 90.0
    assert -180.0 <= lon <= 180.0
    assert 600.0 < alt < 800.0


def test_longitude_wrapping_stays_bounded(records):
    sat = satrec_from_omm(records[1])
    for minutes in range(0, 200):
        _lat, lon, _alt = subpoint(sat, EPOCH + timedelta(minutes=minutes))
        assert -180.0 <= lon <= 180.0


def test_orbital_period(records):
    assert orbital_period_minutes(records[0]) == pytest.approx(98.7, abs=0.2)


def test_pass_over_known_subpoint(records):
    """The satellite must report a very close pass over its own future subpoint."""
    record = records[0]
    sat = satrec_from_omm(record)
    target_time = EPOCH + timedelta(minutes=30)
    lat, lon, _ = subpoint(sat, target_time)
    aoi = validate_geometry({"type": "Point", "coordinates": [lon, lat]})

    passes, skipped = predict_passes(
        [record], aoi, EPOCH, EPOCH + timedelta(hours=2), maximum_distance_km=300.0
    )
    assert skipped == []
    assert passes, "expected at least one pass over the sub-satellite point"
    best = min(passes, key=lambda p: p.minimum_distance_km)
    assert best.minimum_distance_km < 50.0
    assert abs((best.closest_approach_time - target_time).total_seconds()) < 120.0


def test_pass_fields_and_directions(records):
    aoi = validate_geometry({"type": "Point", "coordinates": [36.82, -1.29]})  # Nairobi
    passes, _ = predict_passes(
        [records[0]], aoi, EPOCH, EPOCH + timedelta(hours=24), maximum_distance_km=2000.0
    )
    assert passes
    directions = {p.ascending_or_descending for p in passes}
    assert directions <= {"ascending", "descending"}
    assert len(directions) == 2  # near-polar orbit crosses the equator both ways
    for p in passes:
        assert EPOCH <= p.closest_approach_time <= EPOCH + timedelta(hours=24)
        assert p.minimum_distance_km <= 2000.0
        assert 0.0 <= p.approximate_ground_track_direction_deg < 360.0
        assert p.prediction_confidence == "high"  # element age < 3 days in-window


def test_confidence_degrades_with_element_age(records):
    aoi = validate_geometry({"type": "Point", "coordinates": [36.82, -1.29]})
    start = EPOCH + timedelta(days=10)
    passes, _ = predict_passes(
        [records[0]], aoi, start, start + timedelta(hours=24), maximum_distance_km=2000.0
    )
    assert passes
    assert all(p.prediction_confidence == "low" for p in passes)


def test_polygon_aoi(records):
    aoi = validate_geometry(
        {
            "type": "Polygon",
            "coordinates": [[[35.0, -3.0], [39.0, -3.0], [39.0, 1.0], [35.0, 1.0], [35.0, -3.0]]],
        }
    )
    passes, _ = predict_passes(
        records, aoi, EPOCH, EPOCH + timedelta(hours=24), maximum_distance_km=1500.0
    )
    assert passes
    assert all(p.minimum_distance_km <= 1500.0 for p in passes)


def test_evaluation_budget(records):
    aoi = validate_geometry({"type": "Point", "coordinates": [0.0, 0.0]})
    with pytest.raises(PassPredictionError):
        predict_passes(
            records,
            aoi,
            EPOCH,
            EPOCH + timedelta(days=7),
            maximum_distance_km=500.0,
            max_evaluations=100,
        )


def test_invalid_window(records):
    aoi = validate_geometry({"type": "Point", "coordinates": [0.0, 0.0]})
    with pytest.raises(PassPredictionError):
        predict_passes([records[0]], aoi, EPOCH, EPOCH, maximum_distance_km=500.0)
