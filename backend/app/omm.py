"""Validation and normalisation of CelesTrak OMM (Orbit Mean-Elements Message) JSON."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# field -> (min, max) inclusive physical ranges
NUMERIC_RANGES: dict[str, tuple[float, float]] = {
    "MEAN_MOTION": (0.1, 20.0),  # rev/day; LEO SAR sits around 14-15.5
    "ECCENTRICITY": (0.0, 0.9999),
    "INCLINATION": (0.0, 180.0),
    "RA_OF_ASC_NODE": (0.0, 360.0),
    "ARG_OF_PERICENTER": (0.0, 360.0),
    "MEAN_ANOMALY": (0.0, 360.0),
}

REQUIRED_FIELDS = ("OBJECT_NAME", "NORAD_CAT_ID", "EPOCH", *NUMERIC_RANGES)

# optional numerics that SGP4 consumes when present
OPTIONAL_NUMERIC = ("BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT")


class OmmValidationError(ValueError):
    """A record or payload failed OMM validation."""


def parse_epoch(value: str) -> datetime:
    """Parse an OMM EPOCH string to an aware UTC datetime."""
    text = value.strip()
    if text.endswith(("Z", "z")):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise OmmValidationError(f"unparsable EPOCH {value!r}") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_record(raw: Any) -> dict[str, Any]:
    """Return a normalised copy of one OMM record, or raise OmmValidationError."""
    if not isinstance(raw, dict):
        raise OmmValidationError("record is not an object")
    for name in REQUIRED_FIELDS:
        if raw.get(name) in (None, ""):
            raise OmmValidationError(f"missing field {name}")

    record: dict[str, Any] = dict(raw)
    record["OBJECT_NAME"] = str(raw["OBJECT_NAME"]).strip()
    if not record["OBJECT_NAME"]:
        raise OmmValidationError("empty OBJECT_NAME")

    try:
        norad = int(raw["NORAD_CAT_ID"])
    except (TypeError, ValueError) as exc:
        raise OmmValidationError("non-integer NORAD_CAT_ID") from exc
    if norad <= 0:
        raise OmmValidationError(f"invalid NORAD_CAT_ID {norad}")
    record["NORAD_CAT_ID"] = norad

    record["EPOCH"] = parse_epoch(str(raw["EPOCH"])).isoformat().replace("+00:00", "Z")

    for name, (lo, hi) in NUMERIC_RANGES.items():
        try:
            value = float(raw[name])
        except (TypeError, ValueError) as exc:
            raise OmmValidationError(f"non-numeric {name}") from exc
        if not (lo <= value <= hi):
            raise OmmValidationError(f"{name}={value} outside [{lo}, {hi}]")
        record[name] = value

    for name in OPTIONAL_NUMERIC:
        if raw.get(name) not in (None, ""):
            try:
                record[name] = float(raw[name])
            except (TypeError, ValueError) as exc:
                raise OmmValidationError(f"non-numeric {name}") from exc
        else:
            record[name] = 0.0

    return record


def parse_payload(payload: Any) -> tuple[list[dict[str, Any]], list[str]]:
    """Validate a full CelesTrak payload.

    Returns (valid_records, dropped_reasons). Raises OmmValidationError when the
    payload is not a non-empty list or contains no valid record at all, so a
    broken upstream response never replaces a good cache.
    """
    if not isinstance(payload, list):
        raise OmmValidationError("payload is not a JSON array")
    if not payload:
        raise OmmValidationError("payload is empty")

    valid: list[dict[str, Any]] = []
    dropped: list[str] = []
    for index, raw in enumerate(payload):
        try:
            valid.append(validate_record(raw))
        except OmmValidationError as exc:
            name = raw.get("OBJECT_NAME", f"#{index}") if isinstance(raw, dict) else f"#{index}"
            dropped.append(f"{name}: {exc}")

    if not valid:
        raise OmmValidationError(f"no valid records ({len(dropped)} dropped)")
    return valid, dropped
