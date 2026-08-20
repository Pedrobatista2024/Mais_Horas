"""Regras de participação — porta do participation.service.js."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models import Activity, Participation
from app.utils import serialize


async def create(
    db: AsyncSession, user_id: uuid.UUID, activity_id: uuid.UUID
) -> dict[str, Any]:
    existing = await db.scalar(
        select(Participation).where(
            Participation.activity_id == activity_id,
            Participation.user_id == user_id,
        )
    )
    if existing is not None:
        raise AppError("Você já está inscrito nesta atividade", status.HTTP_409_CONFLICT)

    participation = Participation(
        activity_id=activity_id, user_id=user_id, status="pending", workload_hours=0
    )
    db.add(participation)
    await db.commit()
    await db.refresh(participation)
    return serialize.participation(participation)


async def validate_presence(
    db: AsyncSession,
    participation_id: uuid.UUID,
    validator_id: uuid.UUID,
    new_status: str,
) -> dict[str, Any]:
    participation = await db.get(Participation, participation_id)
    if participation is None:
        raise AppError("Participação não encontrada", status.HTTP_404_NOT_FOUND)

    if new_status == "present":
        activity = await db.get(Activity, participation.activity_id)
        if activity is None or not activity.workload_hours:
            raise AppError(
                "Atividade sem carga horária definida", status.HTTP_400_BAD_REQUEST
            )
        participation.workload_hours = activity.workload_hours
    else:
        participation.workload_hours = 0

    participation.status = new_status
    participation.validated_by = validator_id
    await db.commit()
    await db.refresh(participation)
    return serialize.participation(participation)


async def list_mine(db: AsyncSession, user_id: uuid.UUID) -> list[dict[str, Any]]:
    result = await db.scalars(
        select(Participation)
        .where(Participation.user_id == user_id)
        .options(selectinload(Participation.activity))
        .order_by(Participation.created_at.desc())
    )
    return [serialize.participation_with_activity(p) for p in result]


async def list_by_activity(
    db: AsyncSession, activity_id: uuid.UUID
) -> list[dict[str, Any]]:
    result = await db.scalars(
        select(Participation)
        .where(Participation.activity_id == activity_id)
        .options(selectinload(Participation.user))
        .order_by(Participation.created_at.asc())
    )
    return [serialize.participation_with_user(p) for p in result]
