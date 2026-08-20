"""
Rotas de certificado — `/api/certificates`.

As duas rotas públicas (`/validate/{code}` e `/public/{code}/pdf`) são o coração
da verificação por QR Code: qualquer pessoa confere a autenticidade sem login.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response

from app.core.deps import CurrentUser, DbSession, OrgUser
from app.services import certificate_service
from app.utils.pdf import generate_certificate_pdf

router = APIRouter(prefix="/certificates", tags=["certificados"])


def _pdf_response(certificate: dict[str, Any]) -> Response:
    pdf = generate_certificate_pdf(certificate)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "inline; filename=certificado.pdf"},
    )


# ===================== Públicas (verificação por QR) =====================


@router.get("/validate/{code}")
async def validate_certificate(code: str, db: DbSession) -> Response:
    certificate = await certificate_service.validate_by_code(db, code)
    if certificate is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"valid": False})

    return JSONResponse(
        content=jsonable_encoder({"valid": True, "certificate": certificate})
    )


@router.get("/public/{code}/pdf")
async def public_certificate_pdf(code: str, db: DbSession) -> Response:
    certificate = await certificate_service.get_by_code_for_pdf(db, code)
    return _pdf_response(certificate)


# ===================== Privadas =====================


@router.get("/my")
async def my_certificates(user: CurrentUser, db: DbSession) -> list[dict[str, Any]]:
    return await certificate_service.list_mine(db, user.id)


@router.get("/{certificate_id}/pdf")
async def certificate_pdf(
    certificate_id: uuid.UUID, _: CurrentUser, db: DbSession
) -> Response:
    certificate = await certificate_service.get_for_pdf(db, certificate_id)
    return _pdf_response(certificate)


@router.post("/{participation_id}", status_code=status.HTTP_201_CREATED)
async def generate_certificate(
    participation_id: uuid.UUID, _: OrgUser, db: DbSession
) -> dict[str, Any]:
    certificate = await certificate_service.generate_for_participation(db, participation_id)
    return {"message": "Certificado emitido com sucesso", "certificate": certificate}
