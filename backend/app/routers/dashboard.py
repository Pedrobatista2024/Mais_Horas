"""Rotas de dashboard — `/api/dashboard`."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.deps import DbSession, StudentUser
from app.services import certificate_service, participation_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/student")
async def student_dashboard(user: StudentUser, db: DbSession) -> dict[str, Any]:
    participations = await participation_service.list_mine(db, user.id)
    certificates = await certificate_service.list_mine(db, user.id)
    total_hours = sum(c.get("hours") or 0 for c in certificates)

    return {
        "participations": participations,
        "certificates": certificates,
        "totalHours": total_hours,
    }
