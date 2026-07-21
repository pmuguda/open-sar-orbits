-- Open SAR Orbits — SQLite schema
-- Orbital data (machine-fetched, ephemeral) and the curated registry
-- (human-maintained, seeded from data/registry_seed.json) are kept separate
-- and joined at request time, primarily on NORAD catalogue ID.

CREATE TABLE IF NOT EXISTS orbit_cache (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    fetched_at    TEXT    NOT NULL,           -- ISO-8601 UTC retrieval timestamp
    source_url    TEXT    NOT NULL,
    record_count  INTEGER NOT NULL,
    payload_json  TEXT    NOT NULL            -- validated OMM JSON array
);

CREATE INDEX IF NOT EXISTS idx_orbit_cache_fetched ON orbit_cache (fetched_at DESC);

-- Constellation-level curated defaults, applied to any orbital record whose
-- OBJECT_NAME matches one of name_patterns (case-insensitive substring).
CREATE TABLE IF NOT EXISTS constellations (
    constellation                 TEXT PRIMARY KEY,
    name_patterns                 TEXT NOT NULL,   -- JSON array of patterns
    mission_name                  TEXT,
    operator                      TEXT,
    country                       TEXT,
    status                        TEXT,
    frequency_band                TEXT,
    centre_frequency_ghz          REAL,
    polarisation_modes            TEXT,            -- JSON array
    nominal_altitude_km           REAL,
    inclination_deg               REAL,
    repeat_cycle_days             REAL,
    look_direction                TEXT,
    minimum_incidence_angle_deg   REAL,
    maximum_incidence_angle_deg   REAL,
    minimum_resolution_m          REAL,
    maximum_swath_width_km        REAL,
    open_data_available           TEXT,
    archive_url                   TEXT,
    provider_url                  TEXT,
    documentation_url             TEXT,
    metadata_source               TEXT NOT NULL,
    metadata_last_verified        TEXT NOT NULL
);

-- Per-satellite curated entries; non-null fields override constellation defaults.
CREATE TABLE IF NOT EXISTS satellites (
    object_name                   TEXT NOT NULL,
    norad_catalog_id              INTEGER UNIQUE,
    international_designator      TEXT,
    mission_name                  TEXT,
    constellation                 TEXT REFERENCES constellations (constellation),
    operator                      TEXT,
    country                       TEXT,
    status                        TEXT,
    launch_date                   TEXT,
    frequency_band                TEXT,
    centre_frequency_ghz          REAL,
    polarisation_modes            TEXT,            -- JSON array
    nominal_altitude_km           REAL,
    inclination_deg               REAL,
    repeat_cycle_days             REAL,
    look_direction                TEXT,
    minimum_incidence_angle_deg   REAL,
    maximum_incidence_angle_deg   REAL,
    minimum_resolution_m          REAL,
    maximum_swath_width_km        REAL,
    open_data_available           TEXT,
    archive_url                   TEXT,
    provider_url                  TEXT,
    documentation_url             TEXT,
    metadata_source               TEXT NOT NULL,
    metadata_last_verified        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_satellites_name ON satellites (object_name);
