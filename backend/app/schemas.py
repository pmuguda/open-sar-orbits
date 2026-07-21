"""Pydantic request models."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


class PassRequest(BaseModel):
    geometry: dict[str, Any]
    start_time: datetime
    end_time: datetime
    satellite_ids: list[int] = Field(default_factory=list)
    maximum_distance_km: float = Field(default=500.0, ge=1.0, le=3000.0)

    @model_validator(mode="after")
    def check_window(self) -> PassRequest:
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self
