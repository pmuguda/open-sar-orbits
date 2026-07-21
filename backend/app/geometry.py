"""AOI geometry validation and great-circle helpers (pure Python, WGS-84-ish sphere)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

EARTH_RADIUS_KM = 6371.0088
MAX_POLYGON_VERTICES = 256
MAX_REPRESENTATIVE_POINTS = 64


class GeometryError(ValueError):
    """Invalid AOI geometry."""


def normalize_lon(lon: float) -> float:
    """Wrap a longitude into [-180, 180)."""
    wrapped = math.fmod(lon + 180.0, 360.0)
    if wrapped < 0:
        wrapped += 360.0
    return wrapped - 180.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(normalize_lon(lon2 - lon1))
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def initial_bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle initial bearing from point 1 to point 2, degrees clockwise from north."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlmb = math.radians(normalize_lon(lon2 - lon1))
    y = math.sin(dlmb) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlmb)
    return math.degrees(math.atan2(y, x)) % 360.0


def _check_position(pos: Any) -> tuple[float, float]:
    """Validate one GeoJSON [lon, lat] position, returning (lat, lon)."""
    if (
        not isinstance(pos, (list, tuple))
        or len(pos) < 2
        or not all(isinstance(c, (int, float)) for c in pos[:2])
    ):
        raise GeometryError(f"invalid position {pos!r}")
    lon, lat = float(pos[0]), float(pos[1])
    if not (-180.0 <= lon <= 180.0):
        raise GeometryError(f"longitude {lon} outside [-180, 180]")
    if not (-90.0 <= lat <= 90.0):
        raise GeometryError(f"latitude {lat} outside [-90, 90]")
    return lat, lon


@dataclass
class Aoi:
    kind: str  # "point" | "polygon"
    # polygon ring as (lat, lon) tuples (closed); for a point, one entry
    ring: list[tuple[float, float]]
    representative: list[tuple[float, float]]


def validate_geometry(geometry: Any) -> Aoi:
    """Validate a GeoJSON Point or Polygon geometry into an Aoi.

    Note: polygons spanning the antimeridian are not supported (documented
    limitation) — split them into two AOIs instead.
    """
    if not isinstance(geometry, dict):
        raise GeometryError("geometry must be a GeoJSON object")
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")

    if gtype == "Point":
        lat, lon = _check_position(coords)
        return Aoi(kind="point", ring=[(lat, lon)], representative=[(lat, lon)])

    if gtype == "Polygon":
        if not isinstance(coords, list) or not coords:
            raise GeometryError("polygon has no rings")
        ring_raw = coords[0]
        if not isinstance(ring_raw, list) or len(ring_raw) < 4:
            raise GeometryError("polygon ring needs at least 4 positions")
        if len(ring_raw) > MAX_POLYGON_VERTICES + 1:
            raise GeometryError(f"polygon ring exceeds {MAX_POLYGON_VERTICES} vertices")
        ring = [_check_position(p) for p in ring_raw]
        if ring[0] != ring[-1]:
            raise GeometryError("polygon ring is not closed (first != last position)")
        if len({(round(la, 9), round(lo, 9)) for la, lo in ring}) < 3:
            raise GeometryError("polygon is degenerate")
        return Aoi(kind="polygon", ring=ring, representative=_representative_points(ring))

    raise GeometryError(f"unsupported geometry type {gtype!r} (use Point or Polygon)")


def _representative_points(ring: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """Centroid + vertices + edge midpoints (deduplicated, capped)."""
    vertices = ring[:-1]
    lat_c = sum(p[0] for p in vertices) / len(vertices)
    lon_c = math.degrees(
        math.atan2(
            sum(math.sin(math.radians(p[1])) for p in vertices),
            sum(math.cos(math.radians(p[1])) for p in vertices),
        )
    )
    points: list[tuple[float, float]] = [(lat_c, normalize_lon(lon_c))]
    for i, (la, lo) in enumerate(vertices):
        points.append((la, lo))
        lb, lob = ring[i + 1]
        points.append(((la + lb) / 2.0, normalize_lon((lo + lob) / 2.0)))
    seen: set[tuple[float, float]] = set()
    unique: list[tuple[float, float]] = []
    for p in points:
        key = (round(p[0], 6), round(p[1], 6))
        if key not in seen:
            seen.add(key)
            unique.append(p)
    return unique[:MAX_REPRESENTATIVE_POINTS]


def point_in_polygon(lat: float, lon: float, ring: list[tuple[float, float]]) -> bool:
    """Ray-casting test in lat/lon space (no antimeridian handling)."""
    inside = False
    for i in range(len(ring) - 1):
        la1, lo1 = ring[i]
        la2, lo2 = ring[i + 1]
        if (la1 > lat) != (la2 > lat):
            lon_cross = lo1 + (lat - la1) / (la2 - la1) * (lo2 - lo1)
            if lon < lon_cross:
                inside = not inside
    return inside


def distance_to_aoi_km(lat: float, lon: float, aoi: Aoi) -> float:
    if aoi.kind == "polygon" and point_in_polygon(lat, lon, aoi.ring):
        return 0.0
    return min(haversine_km(lat, lon, la, lo) for la, lo in aoi.representative)
