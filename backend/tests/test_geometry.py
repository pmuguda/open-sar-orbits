from __future__ import annotations

import pytest

from app.geometry import (
    GeometryError,
    distance_to_aoi_km,
    haversine_km,
    initial_bearing_deg,
    normalize_lon,
    point_in_polygon,
    validate_geometry,
)

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[36.0, -2.0], [38.0, -2.0], [38.0, 0.0], [36.0, 0.0], [36.0, -2.0]]],
}


def test_haversine_known_distance():
    # London -> Paris ~ 343 km
    assert haversine_km(51.5074, -0.1278, 48.8566, 2.3522) == pytest.approx(343.5, abs=5)


def test_normalize_lon():
    assert normalize_lon(190.0) == pytest.approx(-170.0)
    assert normalize_lon(-190.0) == pytest.approx(170.0)
    assert normalize_lon(360.0) == pytest.approx(0.0)
    assert normalize_lon(180.0) == pytest.approx(-180.0)
    assert normalize_lon(-180.0) == pytest.approx(-180.0)


def test_haversine_across_antimeridian():
    # 2 degrees of longitude apart across the antimeridian, on the equator
    assert haversine_km(0.0, 179.0, 0.0, -179.0) == pytest.approx(222.4, abs=2)


def test_bearing():
    assert initial_bearing_deg(0.0, 0.0, 1.0, 0.0) == pytest.approx(0.0, abs=0.1)
    assert initial_bearing_deg(0.0, 0.0, 0.0, 1.0) == pytest.approx(90.0, abs=0.1)


def test_point_geometry():
    aoi = validate_geometry({"type": "Point", "coordinates": [36.82, -1.29]})
    assert aoi.kind == "point"
    assert aoi.representative == [(-1.29, 36.82)]


def test_polygon_geometry():
    aoi = validate_geometry(SQUARE)
    assert aoi.kind == "polygon"
    assert point_in_polygon(-1.0, 37.0, aoi.ring)
    assert not point_in_polygon(5.0, 37.0, aoi.ring)
    assert distance_to_aoi_km(-1.0, 37.0, aoi) == 0.0
    assert distance_to_aoi_km(-1.0, 45.0, aoi) > 700


def test_invalid_geometries():
    with pytest.raises(GeometryError):
        validate_geometry({"type": "LineString", "coordinates": [[0, 0], [1, 1]]})
    with pytest.raises(GeometryError):
        validate_geometry({"type": "Point", "coordinates": [200.0, 0.0]})
    with pytest.raises(GeometryError):
        validate_geometry({"type": "Point", "coordinates": [0.0, 95.0]})
    with pytest.raises(GeometryError):  # unclosed ring
        validate_geometry({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1]]]})
    with pytest.raises(GeometryError):  # not a geometry at all
        validate_geometry("POLYGON((0 0))")
    with pytest.raises(GeometryError):  # too many vertices
        ring = [[i * 0.001, 0.0] for i in range(300)]
        ring.append(ring[0])
        validate_geometry({"type": "Polygon", "coordinates": [ring]})


def test_representative_points_include_centroid_and_vertices():
    aoi = validate_geometry(SQUARE)
    assert (-1.0, 37.0) in [(round(la, 1), round(lo, 1)) for la, lo in aoi.representative]
    assert len(aoi.representative) >= 5
