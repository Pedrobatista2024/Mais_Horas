"""Regras de certificado — porta do certificate.service.js."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.db.models import Activity, Certificate, Participation
from app.utils import serialize
from app.utils.verification_code import generate_verification_code

# Carrega aluno, atividade e a ONG criadora de uma vez — o certificado
# populado precisa dos três.
_POPULATED = (
    selectinload(Certificate.user),
    selectinload(Certificate.activity).selectinload(Activity.creator),
)


async def generate_for_participation(
    db: AsyncSession, participation_id: uuid.UUID
) -> dict[str, Any]:
    participation = await db.get(Participation, participation_id)
    if participation is None:
        raise AppError("Participação não encontrada", status.HTTP_404_NOT_FOUND)
    if participation.status != "present":
        raise AppError("Presença ainda não validada", status.HTTP_400_BAD_REQUEST)

    existing = await db.scalar(
        select(Certificate).where(Certificate.participation_id == participation_id)
    )
    if existing is not None:
        raise AppError("Certificado já emitido", status.HTTP_400_BAD_REQUEST)

    certificate = Certificate(
        user_id=participation.user_id,
        activity_id=participation.activity_id,
        participation_id=participation.id,
        hours=participation.workload_hours,
        verification_code=generate_verification_code(),
    )
    db.add(certificate)
    await db.commit()
    await db.refresh(certificate)
    return serialize.certificate(certificate)


async def list_mine(db: AsyncSession, user_id: uuid.UUID) -> list[dict[str, Any]]:
    result = await db.scalars(
        select(Certificate)
        .where(Certificate.user_id == user_id)
        .options(selectinload(Certificate.activity))
        .order_by(Certificate.created_at.desc())
    )
    return [serialize.certificate_for_user(c) for c in result]


async def get_for_pdf(db: AsyncSession, certificate_id: uuid.UUID) -> dict[str, Any]:
    certificate = await db.scalar(
        select(Certificate).where(Certificate.id == certificate_id).options(*_POPULATED)
    )
    if certificate is None:
        raise AppError("Certificado não encontrado", status.HTTP_404_NOT_FOUND)
    return serialize.certificate_populated(certificate)


async def get_by_code_for_pdf(db: AsyncSession, code: str) -> dict[str, Any]:
    certificate = await db.scalar(
        select(Certificate).where(Certificate.verification_code == code).options(*_POPULATED)
    )
    if certificate is None:
        raise AppError("Certificado não encontrado", status.HTTP_404_NOT_FOUND)
    return serialize.certificate_populated(certificate)


async def validate_by_code(db: AsyncSession, code: str) -> dict[str, Any] | None:
    """Devolve o certificado populado, ou None se o código não existir."""
    certificate = await db.scalar(
        select(Certificate).where(Certificate.verification_code == code).options(*_POPULATED)
    )
    if certificate is None:
        return None
    return serialize.certificate_populated(certificate)
