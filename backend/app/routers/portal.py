"""Portal público — `/api/v1/portal`. Nenhuma rota exige login."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Response

from app.core import security
from app.core.deps import Sessao
from app.schemas.comum import Pagina
from app.schemas.portal import OngDoPortal, PerfilPublicoDaOng, ResumoDoPortal
from app.services import certificado_service, portal_service

router = APIRouter(prefix="/portal", tags=["portal"])


@router.get("/resumo", response_model=ResumoDoPortal)
async def resumo(sessao: Sessao) -> dict:
    return await portal_service.resumo(sessao)


@router.get("/chave-publica")
async def chave_publica() -> Response:
    """
    A chave que valida todo certificado emitido aqui — pública por definição.

    Ficava só no console do admin, o que obrigava quem quisesse conferir por
    conta própria a pedir a chave para nós. Uma chave de verificação escondida
    não protege nada: ela existe justamente para circular.
    """
    certificado_service.exigir_chave()
    return Response(
        content=security.chave_publica_pem(),
        media_type="application/x-pem-file",
        headers={"Content-Disposition":
                 'inline; filename="mais-horas-chave-publica.pem"',
                 "Cache-Control": "public, max-age=3600"})


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
