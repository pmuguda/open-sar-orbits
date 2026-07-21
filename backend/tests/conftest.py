from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.celestrak import CelestrakCache
from app.config import Settings
from app.db import Database
from app.omm import parse_payload
from app.registry import Registry, load_seed

FIXTURES = Path(__file__).parent / "fixtures"
SEED_PATH = Path(__file__).parent.parent / "data" / "registry_seed.json"


@pytest.fixture
def omm_payload() -> list:
    return json.loads((FIXTURES / "omm_radar_sample.json").read_text())


@pytest.fixture
def malformed_payload() -> list:
    return json.loads((FIXTURES / "omm_malformed.json").read_text())


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        db_path=str(tmp_path / "test.db"),
        registry_seed_path=str(SEED_PATH),
        refresh_enabled=False,
    )


@pytest.fixture
def db(settings) -> Database:
    database = Database(settings.db_path)
    load_seed(database, settings.registry_seed_path)
    yield database
    database.close()


@pytest.fixture
def registry(db) -> Registry:
    return Registry(db)


@pytest.fixture
def cache(db, settings, omm_payload) -> CelestrakCache:
    instance = CelestrakCache(db, settings, fetcher=lambda: omm_payload)
    records, _ = parse_payload(omm_payload)
    instance.store(records)
    return instance


@pytest.fixture
def client(tmp_path, omm_payload):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.omm import parse_payload as parse

    app_settings = Settings(
        db_path=str(tmp_path / "api.db"),
        registry_seed_path=str(SEED_PATH),
        refresh_enabled=False,
    )
    app = create_app(app_settings)
    records, _ = parse(omm_payload)
    app.state.cache.store(records)
    with TestClient(app) as test_client:
        yield test_client
