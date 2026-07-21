from __future__ import annotations

import json

import pytest

from app.registry import RegistryError, validate_seed
from tests.conftest import SEED_PATH


def test_seed_file_is_valid():
    validate_seed(json.loads(SEED_PATH.read_text()))


def test_norad_join(registry):
    entry, match = registry.enrich(39634, "SENTINEL-1A")
    assert match == "norad"
    assert entry["constellation"] == "Sentinel-1"
    assert entry["frequency_band"] == "C"
    assert entry["open_data_available"] == "yes"
    assert entry["launch_date"] == "2014-04-03"
    # constellation defaults merged in
    assert entry["maximum_swath_width_km"] == 410


def test_satellite_overrides_constellation(registry):
    entry, _ = registry.enrich(41456, "SENTINEL-1B")
    assert entry["status"] == "inactive"  # per-satellite override of active default


def test_pattern_fallback(registry):
    entry, match = registry.enrich(99001, "ICEYE-X99")
    assert match == "pattern"
    assert entry["operator"] == "ICEYE"
    assert entry["frequency_band"] == "X"


def test_no_match(registry):
    entry, match = registry.enrich(99002, "MYSTERY RADAR SAT")
    assert entry is None
    assert match is None


def test_counts(registry):
    counts = registry.counts()
    assert counts["satellite_count"] >= 20
    assert counts["constellation_count"] >= 18


def test_validate_seed_rejects_missing_source():
    with pytest.raises(RegistryError):
        validate_seed(
            {
                "constellations": [],
                "satellites": [{"object_name": "X", "metadata_last_verified": "2026-01-01"}],
            }
        )


def test_validate_seed_rejects_bad_band():
    with pytest.raises(RegistryError):
        validate_seed(
            {
                "constellations": [
                    {
                        "constellation": "Bad",
                        "name_patterns": ["BAD"],
                        "frequency_band": "Z",
                        "metadata_source": "x",
                        "metadata_last_verified": "2026-01-01",
                    }
                ],
                "satellites": [],
            }
        )


def test_pattern_is_prefix_not_substring(registry):
    # TOPAZ contains "PAZ" but must not inherit PAZ metadata
    entry, match = registry.enrich(90210, "TOPAZ 4")
    assert entry is None
    assert match is None

    entry, match = registry.enrich(90211, "PAZ")
    assert match == "pattern"
    assert entry["country"] == "Spain"
