"""Rotas de atividade — `/api/activities`."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, status

from app.core.deps import CurrentUser, DbSession, OrgUser, StudentUser
from app.schemas.activity import AttendanceIn, CreateActivityIn, UpdateActivityIn
from app.services import activity_service

router = APIRouter(prefix="/activities", tags=["atividades"])


@router.get("")
async def list_activities(db: DbSession) -> list[dict[str, Any]]:
    """Pública — a landing e a busca de atividades consomem sem token."""
    return await activity_service.list_all(db)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_activity(
    payload: CreateActivityIn, user: OrgUser, db: DbSession
) -> dict[str, Any]:
    activity = await activity_service.create(db, user.id, payload.model_dump())
    return {"message": "Atividade criada com sucesso!", "activity": activity}


@router.get("/my")
async def my_activities(user: OrgUser, db: DbSession) -> list[dict[str, Any]]:
    return await activity_service.list_by_org(db, user.id)


@router.get("/{activity_id}")
async def activity_details(
    activity_id: uuid.UUID, _: CurrentUser, db: DbSession
) -> dict[str, Any]:
    return await activity_service.get_details(db, activity_id)


@router.post("/{activity_id}/join")
async def join_activity(
    activity_id: uuid.UUID, user: StudentUser, db: DbSession
) -> dict[str, Any]:
    await activity_service.join(db, activity_id, user.id)
    return {"message": "Inscrição realizada com sucesso!"}


@router.put("/{activity_id}")
async def update_activity(
    activity_id: uuid.UUID, payload: UpdateActivityIn, user: OrgUser, db: DbSession
) -> dict[str, Any]:
    activity = await activity_service.update(
        db, activity_id, user.id, payload.model_dump(exclude_unset=True)
    )
    return {"message": "Atividade atualizada com sucesso", "activity": activity}


@router.patch("/{activity_id}/attendance")
async def update_attendance(
    activity_id: uuid.UUID, payload: AttendanceIn, user: OrgUser, db: DbSession
) -> dict[str, Any]:
    await activity_service.update_attendance(db, activity_id, user.id, payload.model_dump())
    return {"message": "Presença atualizada com sucesso"}


@router.post("/{activity_id}/finish")
async def finish_activity(
    activity_id: uuid.UUID, user: OrgUser, db: DbSession
) -> dict[str, Any]:
    result = await activity_service.finish(db, activity_id, user.id)
    return {"message": "Atividade finalizada com sucesso", **result}


@router.delete("/{activity_id}")
async def delete_activity(
    activity_id: uuid.UUID, user: OrgUser, db: DbSession
) -> dict[str, Any]:
    await activity_service.remove(db, activity_id, user.id)
    return {"message": "Atividade excluída"}
