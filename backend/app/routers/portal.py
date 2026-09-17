"""Portal público — `/api/v1/portal`. Nenhuma rota exige login."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.core.deps import Sessao
from app.schemas.comum import Pagina
from app.schemas.portal import OngDoPortal, PerfilPublicoDaOng, ResumoDoPortal
from app.services import portal_service

router = APIRouter(prefix="/portal", tags=["portal"])


@router.get("/resumo", response_model=ResumoDoPortal)
async def resumo(sessao: Sessao) -> dict:
    return await portal_service.resumo(sessao)


@router.get("/ongs", response_model=Pagina[OngDoPortal])
async def ongs(
    sessao: Sessao, busca: str | None = None,
    pagina: int = Query(1, ge=1), tamanho: int = Query(12, ge=1, le=48),
) -> Pagina:
    itens, total = await portal_service.listar_ongs(
        sessao, busca=busca, pagina=pagina, tamanho=tamanho)
    return Pagina.montar(itens, total, pagina, tamanho)


@router.get("/ongs/{ong_id}", response_model=PerfilPublicoDaOng)
async def ong(ong_id: uuid.UUID, sessao: Sessao) -> dict:
    return await portal_service.detalhar_ong(sessao, ong_id)
