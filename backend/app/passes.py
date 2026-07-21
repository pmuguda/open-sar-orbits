"""SGP4-based AOI pass prediction.

Coarse scan of the sub-satellite track against the AOI, followed by
golden-section refinement of each local minimum. Distances are measured to the
sub-satellite ground track — this is orbital proximity, NOT an imaging
opportunity (see docs/methodology.md).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sgp4.api import WGS72, Satrec, jday

from .geometry import Aoi, distance_to_aoi_km, initial_bearing_deg, normalize_lon
from .omm import parse_epoch

# WGS-84 ellipsoid
_A_KM = 6378.137
_E2 = 6.69437999014e-3

DISCLAIMER = (
    "An orbital pass does not mean that the satellite acquired or can acquire imagery "
    "of the AOI. Actual SAR imaging depends on spacecraft attitude, look direction, "
    "incidence-angle limits, acquisition mode, operator scheduling, tasking constraints "
    "and data availability."
)


class PassPredictionError(ValueError):
    """Request exceeds limits or cannot be evaluated."""


class PropagationError(RuntimeError):
    """SGP4 failed for a satellite."""


def gmst_rad(jd_ut1: float) -> float:
    """Greenwich Mean Sidereal Time (IAU 1982, Vallado) in radians."""
    tut1 = (jd_ut1 - 2451545.0) / 36525.0
    seconds = (
        -6.2e-6 * tut1**3
        + 0.093104 * tut1**2
        + (876600.0 * 3600.0 + 8640184.812866) * tut1
        + 67310.54841
    )
    return math.radians((seconds / 240.0) % 360.0) % (2 * math.pi)


def teme_to_geodetic(r_km: tuple[float, float, float], gmst: float) -> tuple[float, float, float]:
    """TEME position vector -> geodetic (lat_deg, lon_deg, alt_km), WGS-84."""
    x, y, z = r_km
    lon = normalize_lon(math.degrees(math.atan2(y, x) - gmst))
    r_xy = math.sqrt(x * x + y * y)
    lat = math.atan2(z, r_xy)
    c = 1.0
    for _ in range(6):
        sin_lat = math.sin(lat)
        c = 1.0 / math.sqrt(1.0 - _E2 * sin_lat * sin_lat)
        lat = math.atan2(z + _A_KM * c * _E2 * sin_lat, r_xy)
    alt = r_xy / math.cos(lat) - _A_KM * c
    return math.degrees(lat), lon, alt


def satrec_from_omm(record: dict[str, Any]) -> Satrec:
    """Initialise an SGP4 Satrec directly from a validated OMM record."""
    epoch = parse_epoch(record["EPOCH"])
    jd, fr = jday(
        epoch.year,
        epoch.month,
        epoch.day,
        epoch.hour,
        epoch.minute,
        epoch.second + epoch.microsecond / 1e6,
    )
    sat = Satrec()
    sat.sgp4init(
        WGS72,
        "i",
        int(record["NORAD_CAT_ID"]),
        jd + fr - 2433281.5,  # days since 1949-12-31 00:00 UT
        float(record.get("BSTAR", 0.0)),
        float(record.get("MEAN_MOTION_DOT", 0.0)),
        float(record.get("MEAN_MOTION_DDOT", 0.0)),
        float(record["ECCENTRICITY"]),
        math.radians(float(record["ARG_OF_PERICENTER"])),
        math.radians(float(record["INCLINATION"])),
        math.radians(float(record["MEAN_ANOMALY"])),
        float(record["MEAN_MOTION"]) * 2.0 * math.pi / 1440.0,  # rev/day -> rad/min
        math.radians(float(record["RA_OF_ASC_NODE"])),
    )
    return sat


def subpoint(sat: Satrec, when: datetime) -> tuple[float, float, float]:
    """Geodetic sub-satellite point (lat_deg, lon_deg, alt_km) at a UTC datetime."""
    jd, fr = jday(
        when.year,
        when.month,
        when.day,
        when.hour,
        when.minute,
        when.second + when.microsecond / 1e6,
    )
    error, r, _v = sat.sgp4(jd, fr)
    if error != 0:
        raise PropagationError(f"SGP4 error code {error}")
    return teme_to_geodetic(r, gmst_rad(jd + fr))


def _golden_section(f: Any, lo: float, hi: float, tol: float = 1.0) -> tuple[float, float]:
    """Minimise f over [lo, hi] (seconds); returns (t_min, f_min)."""
    inv_phi = (math.sqrt(5.0) - 1.0) / 2.0
    a, b = lo, hi
    c = b - inv_phi * (b - a)
    d = a + inv_phi * (b - a)
    fc, fd = f(c), f(d)
    while (b - a) > tol:
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - inv_phi * (b - a)
            fc = f(c)
        else:
            a, c, fc = c, d, fd
            d = a + inv_phi * (b - a)
            fd = f(d)
    t = (a + b) / 2.0
    return t, f(t)


def _confidence(epoch: datetime, at: datetime) -> str:
    age_days = abs((at - epoch).total_seconds()) / 86400.0
    if age_days < 3.0:
        return "high"
    if age_days < 7.0:
        return "medium"
    return "low"


@dataclass
class PassResult:
    satellite_name: str
    norad_catalog_id: int
    closest_approach_time: datetime
    minimum_distance_km: float
    ascending_or_descending: str
    approximate_ground_track_direction_deg: float
    orbit_data_epoch: str
    prediction_confidence: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "satellite_name": self.satellite_name,
            "norad_catalog_id": self.norad_catalog_id,
            "closest_approach_time": self.closest_approach_time.isoformat().replace("+00:00", "Z"),
            "minimum_distance_km": round(self.minimum_distance_km, 1),
            "ascending_or_descending": self.ascending_or_descending,
            "approximate_ground_track_direction_deg": round(
                self.approximate_ground_track_direction_deg, 1
            ),
            "orbit_data_epoch": self.orbit_data_epoch,
            "prediction_confidence": self.prediction_confidence,
        }


def predict_passes(
    records: list[dict[str, Any]],
    aoi: Aoi,
    start: datetime,
    end: datetime,
    maximum_distance_km: float,
    max_evaluations: int = 5_000_000,
) -> tuple[list[PassResult], list[dict[str, Any]]]:
    """Find close approaches of each satellite's ground track to the AOI.

    Returns (passes, skipped) where skipped lists satellites whose propagation
    failed. Raises PassPredictionError when the request exceeds the compute budget.
    """
    if end <= start:
        raise PassPredictionError("end_time must be after start_time")
    window_s = (end - start).total_seconds()
    coarse_step = 60.0 if window_s <= 3 * 86400 else 120.0
    steps = int(window_s // coarse_step) + 1
    if steps * max(len(records), 1) > max_evaluations:
        raise PassPredictionError(
            "prediction window too large — narrow the time range or pass satellite_ids"
        )

    # a coarse sample can sit up to step/2 from the true minimum; the ground
    # track moves at ~7 km/s, so widen the candidate gate accordingly
    candidate_gate_km = maximum_distance_km + 3.6 * coarse_step

    passes: list[PassResult] = []
    skipped: list[dict[str, Any]] = []

    for record in records:
        try:
            sat = satrec_from_omm(record)
            epoch = parse_epoch(record["EPOCH"])

            def distance_at(offset_s: float, sat: Satrec = sat) -> float:
                lat, lon, _ = subpoint(sat, start + timedelta(seconds=offset_s))
                return distance_to_aoi_km(lat, lon, aoi)

            distances = [distance_at(i * coarse_step) for i in range(steps)]
            found: list[tuple[float, float]] = []
            for i in range(1, steps - 1):
                if (
                    distances[i] <= distances[i - 1]
                    and distances[i] <= distances[i + 1]
                    and distances[i] < candidate_gate_km
                ):
                    t_min, d_min = _golden_section(
                        distance_at, (i - 1) * coarse_step, (i + 1) * coarse_step
                    )
                    if d_min <= maximum_distance_km:
                        found.append((t_min, d_min))

            # merge refinements that collapsed into the same approach
            found.sort()
            merged: list[tuple[float, float]] = []
            for t_min, d_min in found:
                if merged and (t_min - merged[-1][0]) < 300.0:
                    if d_min < merged[-1][1]:
                        merged[-1] = (t_min, d_min)
                else:
                    merged.append((t_min, d_min))

            for t_min, d_min in merged[:200]:
                when = start + timedelta(seconds=t_min)
                lat_b, lon_b, _ = subpoint(sat, when - timedelta(seconds=15))
                lat_a, lon_a, _ = subpoint(sat, when + timedelta(seconds=15))
                passes.append(
                    PassResult(
                        satellite_name=record["OBJECT_NAME"],
                        norad_catalog_id=record["NORAD_CAT_ID"],
                        closest_approach_time=when.astimezone(timezone.utc),
                        minimum_distance_km=d_min,
                        ascending_or_descending=("ascending" if lat_a > lat_b else "descending"),
                        approximate_ground_track_direction_deg=initial_bearing_deg(
                            lat_b, lon_b, lat_a, lon_a
                        ),
                        orbit_data_epoch=record["EPOCH"],
                        prediction_confidence=_confidence(epoch, when),
                    )
                )
        except PropagationError as exc:
            skipped.append({"norad_catalog_id": record.get("NORAD_CAT_ID"), "reason": str(exc)})

    passes.sort(key=lambda p: p.closest_approach_time)
    return passes, skipped


def orbital_period_minutes(record: dict[str, Any]) -> Optional[float]:
    try:
        return round(1440.0 / float(record["MEAN_MOTION"]), 2)
    except (KeyError, TypeError, ValueError, ZeroDivisionError):
        return None
