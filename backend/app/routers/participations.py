"""Rotas de participação — `/api/participations`."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession, OrgUser, StudentUser
from app.schemas.participation import CreateParticipationIn, ValidatePresenceIn
from app.services import participation_service

router = APIRouter(prefix="/participations", tags=["participacoes"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_participation(
    payload: CreateParticipationIn, user: StudentUser, db: DbSession
) -> dict[str, Any]:
    participation = await participation_service.create(db, user.id, payload.activityId)
    return {"message": "Participação registrada", "participation": participation}


@router.get("/my")
async def my_participations(user: CurrentUser, db: DbSession) -> list[dict[str, Any]]:
    return await participation_service.list_mine(db, user.id)


@router.get("/activity/{activity_id}")
async def activity_participations(
    activity_id: uuid.UUID, _: CurrentUser, db: DbSession
) -> list[dict[str, Any]]:
    return await participation_service.list_by_activity(db, activity_id)


@router.put("/{participation_id}/validate")
async def validate_presence(
    participation_id: uuid.UUID,
    payload: ValidatePresenceIn,
    user: OrgUser,
    db: DbSession,
) -> dict[str, Any]:
    participation = await participation_service.validate_presence(
        db, participation_id, user.id, payload.status
    )
    return {"message": "Presença atualizada!", "participation": participation}
