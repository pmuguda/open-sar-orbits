from __future__ import annotations

import pytest

from app.omm import OmmValidationError, parse_epoch, parse_payload, validate_record


def test_parse_valid_payload(omm_payload):
    records, dropped = parse_payload(omm_payload)
    assert len(records) == 4
    assert dropped == []
    first = records[0]
    assert first["NORAD_CAT_ID"] == 39634
    assert isinstance(first["MEAN_MOTION"], float)
    assert first["EPOCH"].endswith("Z")


def test_epoch_variants():
    assert parse_epoch("2026-07-20T12:00:00.000000").isoformat() == "2026-07-20T12:00:00+00:00"
    assert parse_epoch("2026-07-20T12:00:00Z").isoformat() == "2026-07-20T12:00:00+00:00"
    with pytest.raises(OmmValidationError):
        parse_epoch("garbage")


def test_malformed_records_dropped(omm_payload, malformed_payload):
    records, dropped = parse_payload(omm_payload + malformed_payload)
    assert len(records) == 4
    assert len(dropped) == 4


def test_all_invalid_raises(malformed_payload):
    with pytest.raises(OmmValidationError):
        parse_payload(malformed_payload)


def test_empty_payload_raises():
    with pytest.raises(OmmValidationError):
        parse_payload([])
    with pytest.raises(OmmValidationError):
        parse_payload({"not": "a list"})


def test_validate_record_ranges(omm_payload):
    bad = dict(omm_payload[0])
    bad["INCLINATION"] = 250.0
    with pytest.raises(OmmValidationError):
        validate_record(bad)

    bad = dict(omm_payload[0])
    bad["MEAN_MOTION"] = "not-a-number"
    with pytest.raises(OmmValidationError):
        validate_record(bad)


def test_optional_numeric_defaults(omm_payload):
    raw = dict(omm_payload[0])
    raw.pop("BSTAR")
    record = validate_record(raw)
    assert record["BSTAR"] == 0.0
