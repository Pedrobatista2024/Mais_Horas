"""
Rotas do console administrativo — `/api/v1/admin`.

Por enquanto só a revogação de certificado, que a Fatia 6 precisa para o
desfecho "revogado" existir. O restante do console entra na Fatia 8.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from app.core.deps import Admin, Sessao
from app.schemas.certificado import CertificadoSaida, RevogacaoEntrada
from app.services import certificado_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/certificados/{certificado_id}/revogar",
             response_model=CertificadoSaida)
async def revogar(
    request: Request, certificado_id: uuid.UUID, dados: RevogacaoEntrada,
    admin: Admin, sessao: Sessao,
) -> dict:
    return await certificado_service.revogar(
        sessao, admin, certificado_id, dados.motivo, request=request)


@router.post("/certificados/{certificado_id}/reverter-revogacao",
             response_model=CertificadoSaida)
async def reverter(
    request: Request, certificado_id: uuid.UUID, admin: Admin, sessao: Sessao,
) -> dict:
    return await certificado_service.reverter_revogacao(
        sessao, admin, certificado_id, request=request)
