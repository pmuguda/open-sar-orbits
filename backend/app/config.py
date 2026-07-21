"""Environment-driven application settings."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Base GP endpoint. Note: CelesTrak's GROUP=radar is the *radar calibration*
# group (CALSPHERE etc.), not SAR imagers — SAR satellites are fetched via
# curated NAME= queries listed in the registry seed (celestrak_name_queries).
DEFAULT_CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
DEFAULT_SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "registry_seed.json"

# CelesTrak asks users not to poll GP data at high frequency; enforce a floor.
MIN_REFRESH_SECONDS = 3600


@dataclass
class Settings:
    celestrak_url: str = DEFAULT_CELESTRAK_URL
    refresh_seconds: int = 21600  # re-fetch when the cache is older than 6 h
    refresh_check_seconds: int = 900  # how often the background loop wakes up
    refresh_enabled: bool = True
    stale_after_hours: float = 24.0
    db_path: str = str(Path(__file__).resolve().parent.parent / "data" / "app.db")
    registry_seed_path: str = str(DEFAULT_SEED_PATH)
    cors_origins: list[str] = field(default_factory=lambda: ["*"])
    max_pass_window_days: float = 31.0
    max_pass_evaluations: int = 5_000_000
    http_timeout_seconds: float = 30.0


def get_settings() -> Settings:
    s = Settings()
    s.celestrak_url = os.environ.get("CELESTRAK_URL", s.celestrak_url)
    s.refresh_seconds = max(
        int(os.environ.get("REFRESH_SECONDS", s.refresh_seconds)), MIN_REFRESH_SECONDS
    )
    s.refresh_enabled = os.environ.get("REFRESH_ENABLED", "1") not in ("0", "false", "no")
    s.stale_after_hours = float(os.environ.get("STALE_AFTER_HOURS", s.stale_after_hours))
    s.db_path = os.environ.get("DB_PATH", s.db_path)
    s.registry_seed_path = os.environ.get("REGISTRY_SEED_PATH", s.registry_seed_path)
    origins = os.environ.get("CORS_ORIGINS")
    if origins:
        s.cors_origins = [o.strip() for o in origins.split(",") if o.strip()]
    return s
