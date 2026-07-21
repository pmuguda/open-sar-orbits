"""Curated SAR satellite registry: seed loading, validation, and orbit joining."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Optional

from .db import Database

SATELLITE_FIELDS = [
    "object_name",
    "norad_catalog_id",
    "international_designator",
    "mission_name",
    "constellation",
    "operator",
    "country",
    "status",
    "launch_date",
    "frequency_band",
    "centre_frequency_ghz",
    "polarisation_modes",
    "nominal_altitude_km",
    "inclination_deg",
    "repeat_cycle_days",
    "look_direction",
    "minimum_incidence_angle_deg",
    "maximum_incidence_angle_deg",
    "minimum_resolution_m",
    "maximum_swath_width_km",
    "open_data_available",
    "archive_url",
    "provider_url",
    "documentation_url",
    "metadata_source",
    "metadata_last_verified",
]

CONSTELLATION_FIELDS = [
    "constellation",
    "name_patterns",
    "mission_name",
    "operator",
    "country",
    "status",
    "frequency_band",
    "centre_frequency_ghz",
    "polarisation_modes",
    "nominal_altitude_km",
    "inclination_deg",
    "repeat_cycle_days",
    "look_direction",
    "minimum_incidence_angle_deg",
    "maximum_incidence_angle_deg",
    "minimum_resolution_m",
    "maximum_swath_width_km",
    "open_data_available",
    "archive_url",
    "provider_url",
    "documentation_url",
    "metadata_source",
    "metadata_last_verified",
]

VALID_STATUS = {"active", "inactive", "unknown", None}
VALID_BANDS = {"L", "S", "C", "X", "P", "Ku", "Ka", "L+S", None}
VALID_OPEN_DATA = {"yes", "no", "partial", "unknown", None}
VALID_LOOK = {"right", "left", "both", None}

_JSON_FIELDS = {"polarisation_modes", "name_patterns"}


class RegistryError(ValueError):
    """The registry seed is malformed."""


def validate_seed(seed: Any) -> None:
    if not isinstance(seed, dict):
        raise RegistryError("seed must be an object")
    for key in ("constellations", "satellites"):
        if not isinstance(seed.get(key), list):
            raise RegistryError(f"seed.{key} must be a list")

    seen_constellations = set()
    for entry in seed["constellations"]:
        name = entry.get("constellation")
        if not name or name in seen_constellations:
            raise RegistryError(f"duplicate or missing constellation name: {name!r}")
        seen_constellations.add(name)
        patterns = entry.get("name_patterns")
        if not isinstance(patterns, list) or not all(isinstance(p, str) and p for p in patterns):
            raise RegistryError(f"{name}: name_patterns must be a non-empty string list")
        _validate_common(entry, f"constellation {name}")

    seen_norad = set()
    for entry in seed["satellites"]:
        name = entry.get("object_name")
        if not name:
            raise RegistryError("satellite entry missing object_name")
        norad = entry.get("norad_catalog_id")
        if norad is not None:
            if not isinstance(norad, int) or norad <= 0:
                raise RegistryError(f"{name}: invalid norad_catalog_id {norad!r}")
            if norad in seen_norad:
                raise RegistryError(f"{name}: duplicate norad_catalog_id {norad}")
            seen_norad.add(norad)
        constellation = entry.get("constellation")
        if constellation is not None and constellation not in seen_constellations:
            raise RegistryError(f"{name}: unknown constellation {constellation!r}")
        _validate_common(entry, f"satellite {name}")


def _validate_common(entry: dict[str, Any], label: str) -> None:
    if not entry.get("metadata_source"):
        raise RegistryError(f"{label}: metadata_source is required")
    if not entry.get("metadata_last_verified"):
        raise RegistryError(f"{label}: metadata_last_verified is required")
    if entry.get("status") not in VALID_STATUS:
        raise RegistryError(f"{label}: invalid status {entry.get('status')!r}")
    if entry.get("frequency_band") not in VALID_BANDS:
        raise RegistryError(f"{label}: invalid frequency_band {entry.get('frequency_band')!r}")
    if entry.get("open_data_available") not in VALID_OPEN_DATA:
        raise RegistryError(
            f"{label}: invalid open_data_available {entry.get('open_data_available')!r}"
        )
    if entry.get("look_direction") not in VALID_LOOK:
        raise RegistryError(f"{label}: invalid look_direction {entry.get('look_direction')!r}")


def load_seed(db: Database, path: str) -> None:
    seed = json.loads(Path(path).read_text())
    validate_seed(seed)

    def row(entry: dict[str, Any], fields: list[str]) -> tuple[Any, ...]:
        values = []
        for f in fields:
            v = entry.get(f)
            if f in _JSON_FIELDS and v is not None:
                v = json.dumps(v)
            values.append(v)
        return tuple(values)

    with db.lock, db.conn:
        db.conn.execute("DELETE FROM constellations")
        db.conn.execute("DELETE FROM satellites")
        db.conn.executemany(
            f"INSERT INTO constellations ({', '.join(CONSTELLATION_FIELDS)})"
            f" VALUES ({', '.join('?' * len(CONSTELLATION_FIELDS))})",
            [row(e, CONSTELLATION_FIELDS) for e in seed["constellations"]],
        )
        db.conn.executemany(
            f"INSERT INTO satellites ({', '.join(SATELLITE_FIELDS)})"
            f" VALUES ({', '.join('?' * len(SATELLITE_FIELDS))})",
            [row(e, SATELLITE_FIELDS) for e in seed["satellites"]],
        )


def _decode(row: sqlite3.Row) -> dict[str, Any]:
    entry = dict(row)
    for f in _JSON_FIELDS & set(entry):
        if entry[f] is not None:
            entry[f] = json.loads(entry[f])
    return entry


class Registry:
    """Read-side access with in-memory pattern index."""

    def __init__(self, db: Database) -> None:
        self.db = db
        self.reload()

    def reload(self) -> None:
        self._constellations = [
            _decode(r) for r in self.db.query("SELECT * FROM constellations ORDER BY constellation")
        ]
        self._by_norad: dict[int, dict[str, Any]] = {}
        for r in self.db.query("SELECT * FROM satellites"):
            entry = _decode(r)
            if entry.get("norad_catalog_id") is not None:
                self._by_norad[entry["norad_catalog_id"]] = entry

    def constellation_defaults(self, name: str) -> Optional[dict[str, Any]]:
        for c in self._constellations:
            if c["constellation"] == name:
                return c
        return None

    def match_pattern(self, object_name: str) -> Optional[dict[str, Any]]:
        # prefix (not substring) match, so e.g. TOPAZ never matches pattern PAZ
        upper = object_name.upper()
        for c in self._constellations:
            if any(upper.startswith(p.upper()) for p in c["name_patterns"]):
                return c
        return None

    def enrich(
        self, norad_id: Optional[int], object_name: str
    ) -> tuple[Optional[dict[str, Any]], Optional[str]]:
        """Join curated metadata to an orbital record.

        Returns (merged_entry, match_type) where match_type is "norad",
        "pattern" or None. A NORAD match merges constellation defaults under
        the satellite's own non-null fields.
        """
        sat = self._by_norad.get(norad_id) if norad_id is not None else None
        if sat is not None:
            merged: dict[str, Any] = {}
            defaults = (
                self.constellation_defaults(sat["constellation"])
                if sat.get("constellation")
                else None
            )
            if defaults:
                merged.update(
                    {k: v for k, v in defaults.items() if k != "name_patterns" and v is not None}
                )
            merged.update({k: v for k, v in sat.items() if v is not None})
            return merged, "norad"

        defaults = self.match_pattern(object_name)
        if defaults is not None:
            merged = {k: v for k, v in defaults.items() if k != "name_patterns" and v is not None}
            return merged, "pattern"
        return None, None

    def counts(self) -> dict[str, Any]:
        dates = [
            c["metadata_last_verified"] for c in self._constellations if c["metadata_last_verified"]
        ]
        return {
            "satellite_count": len(self._by_norad),
            "constellation_count": len(self._constellations),
            "last_verified_max": max(dates) if dates else None,
        }
