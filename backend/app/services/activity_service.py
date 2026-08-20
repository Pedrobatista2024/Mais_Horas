"""Regras de atividade — porta do activity.service.js."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models import Activity, Certificate, Participation
from app.utils import serialize
from app.utils.dates import is_past_date, parse_date_only_to_utc_noon
from app.utils.verification_code import generate_verification_code


def _capitalize(value: str | None) -> str | None:
    """Primeira letra maiúscula, preservando o resto — como no backend Node."""
    if not value or not isinstance(value, str):
        return value
    trimmed = value.strip()
    return trimmed[0].upper() + trimmed[1:] if trimmed else trimmed


async def _get_or_404(db: AsyncSession, activity_id: uuid.UUID) -> Activity:
    activity = await db.get(Activity, activity_id)
    if activity is None:
        raise AppError("Atividade não encontrada", status.HTTP_404_NOT_FOUND)
    return activity


async def _assert_owner(db: AsyncSession, activity_id: uuid.UUID, user_id: uuid.UUID) -> Activity:
    activity = await _get_or_404(db, activity_id)
    if activity.created_by != user_id:
        raise AppError("Acesso negado", status.HTTP_403_FORBIDDEN)
    return activity


async def _count_participants(db: AsyncSession, activity_id: uuid.UUID) -> int:
    total = await db.scalar(
        select(func.count())
        .select_from(Participation)
        .where(Participation.activity_id == activity_id)
    )
    return int(total or 0)


async def create(db: AsyncSession, user_id: uuid.UUID, data: dict[str, Any]) -> dict[str, Any]:
    date = parse_date_only_to_utc_noon(data["date"])
    if date is None:
        raise AppError("Data inválida", status.HTTP_400_BAD_REQUEST)
    if is_past_date(date):
        raise AppError("A data da atividade não pode ser no passado", status.HTTP_400_BAD_REQUEST)

    activity = Activity(
        title=_capitalize(data["title"]),
        description=_capitalize(data["description"]),
        location=_capitalize(data["location"]),
        date=date,
        start_time=data["startTime"],
        end_time=data["endTime"],
        workload_hours=data["workloadHours"],
        min_participants=data["minParticipants"],
        max_participants=data["maxParticipants"],
        created_by=user_id,
        status="active",
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return serialize.activity(activity)


async def list_all(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.scalars(
        select(Activity)
        .options(selectinload(Activity.creator))
        .order_by(Activity.created_at.desc())
    )
    return [serialize.activity_with_creator(a) for a in result]


async def list_by_org(db: AsyncSession, user_id: uuid.UUID) -> list[dict[str, Any]]:
    result = await db.scalars(
        select(Activity)
        .where(Activity.created_by == user_id)
        .order_by(Activity.created_at.desc())
    )
    return [serialize.activity(a) for a in result]


async def get_details(db: AsyncSession, activity_id: uuid.UUID) -> dict[str, Any]:
    activity = await db.scalar(
        select(Activity)
        .where(Activity.id == activity_id)
        .options(selectinload(Activity.creator))
    )
    if activity is None:
        raise AppError("Atividade não encontrada", status.HTTP_404_NOT_FOUND)

    participations = await db.scalars(
        select(Participation)
        .where(Participation.activity_id == activity_id)
        .options(selectinload(Participation.user))
        .order_by(Participation.created_at.asc())
    )

    data = serialize.activity_with_creator(activity)
    data["participants"] = [serialize.participation_with_user(p) for p in participations]
    return data


async def update(
    db: AsyncSession, activity_id: uuid.UUID, user_id: uuid.UUID, body: dict[str, Any]
) -> dict[str, Any]:
    activity = await _assert_owner(db, activity_id, user_id)
    enrolled = await _count_participants(db, activity_id)

    if body.get("maxParticipants") is not None and body["maxParticipants"] < enrolled:
        raise AppError(
            f"O número máximo não pode ser menor que o total de inscritos ({enrolled})",
            status.HTTP_400_BAD_REQUEST,
        )

    if enrolled > 0:
        # Com gente inscrita, só os limites de vaga podem mudar.
        if body.get("minParticipants") is not None:
            activity.min_participants = body["minParticipants"]
        if body.get("maxParticipants") is not None:
            activity.max_participants = body["maxParticipants"]
    else:
        if body.get("startTime") is not None:
            activity.start_time = body["startTime"]
        if body.get("endTime") is not None:
            activity.end_time = body["endTime"]
        if body.get("workloadHours") is not None:
            activity.workload_hours = body["workloadHours"]
        if body.get("minParticipants") is not None:
            activity.min_participants = body["minParticipants"]
        if body.get("maxParticipants") is not None:
            activity.max_participants = body["maxParticipants"]
        if body.get("title") is not None:
            activity.title = _capitalize(body["title"])
        if body.get("description") is not None:
            activity.description = _capitalize(body["description"])
        if body.get("location") is not None:
            activity.location = _capitalize(body["location"])
        if body.get("date") is not None:
            date = parse_date_only_to_utc_noon(body["date"])
            if date is None:
                raise AppError("Data inválida", status.HTTP_400_BAD_REQUEST)
            if is_past_date(date):
                raise AppError(
                    "A data da atividade não pode ser no passado", status.HTTP_400_BAD_REQUEST
                )
            activity.date = date

    await db.commit()
    await db.refresh(activity)
    return serialize.activity(activity)


async def update_attendance(
    db: AsyncSession, activity_id: uuid.UUID, user_id: uuid.UUID, data: dict[str, Any]
) -> None:
    activity = await _assert_owner(db, activity_id, user_id)

    participation = await db.scalar(
        select(Participation).where(
            Participation.activity_id == activity_id,
            Participation.user_id == data["userId"],
        )
    )
    if participation is None:
        raise AppError("Participação não encontrada", status.HTTP_404_NOT_FOUND)

    participation.status = data["status"]
    participation.validated_by = user_id
    participation.workload_hours = (
        activity.workload_hours if data["status"] == "present" else 0
    )
    await db.commit()


async def join(db: AsyncSession, activity_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any]:
    activity = await db.get(Activity, activity_id)
    if activity is None or activity.status != "active":
        raise AppError("Atividade lotada ou encerrada", status.HTTP_400_BAD_REQUEST)

    already = await db.scalar(
        select(Participation).where(
            Participation.activity_id == activity_id,
            Participation.user_id == user_id,
        )
    )
    if already is not None:
        raise AppError("Você já está inscrito", status.HTTP_400_BAD_REQUEST)

    count = await _count_participants(db, activity_id)
    if count >= activity.max_participants:
        raise AppError("Atividade lotada", status.HTTP_400_BAD_REQUEST)

    participation = Participation(
        activity_id=activity_id, user_id=user_id, status="pending", workload_hours=0
    )
    db.add(participation)
    await db.commit()
    await db.refresh(participation)
    return serialize.participation(participation)


async def finish(db: AsyncSession, activity_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any]:
    activity = await _assert_owner(db, activity_id, user_id)

    if not activity.workload_hours or activity.workload_hours <= 0:
        raise AppError(
            "Carga horária inválida. Verifique a atividade antes de finalizar",
            status.HTTP_400_BAD_REQUEST,
        )
    if activity.status != "active":
        raise AppError("Atividade já finalizada ou cancelada", status.HTTP_400_BAD_REQUEST)

    pending = await db.scalar(
        select(func.count())
        .select_from(Participation)
        .where(Participation.activity_id == activity_id, Participation.status == "pending")
    )
    if int(pending or 0) > 0:
        raise AppError(
            "Finalize a presença de todos os participantes antes de encerrar a atividade",
            status.HTTP_400_BAD_REQUEST,
        )

    present = await db.scalars(
        select(Participation).where(
            Participation.activity_id == activity_id, Participation.status == "present"
        )
    )

    issued = 0
    for participation in present:
        exists = await db.scalar(
            select(Certificate).where(Certificate.participation_id == participation.id)
        )
        if exists is None:
            db.add(
                Certificate(
                    user_id=participation.user_id,
                    activity_id=activity.id,
                    participation_id=participation.id,
                    hours=activity.workload_hours,
                    verification_code=generate_verification_code(),
                )
            )
            issued += 1

    activity.status = "finished"
    await db.commit()
    return {"certificadosGerados": issued}


async def remove(db: AsyncSession, activity_id: uuid.UUID, user_id: uuid.UUID) -> None:
    activity = await _assert_owner(db, activity_id, user_id)
    # As FKs têm ON DELETE CASCADE, então participações e certificados vão junto.
    await db.delete(activity)
    await db.commit()
