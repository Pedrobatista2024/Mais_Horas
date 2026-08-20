"""Schemas de participação."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel


class CreateParticipationIn(BaseModel):
    activityId: uuid.UUID


class ValidatePresenceIn(BaseModel):
    status: Literal["pending", "present", "absent"]
