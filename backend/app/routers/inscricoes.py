"""Rotas de inscrição — `/api/v1/inscricoes`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query, Request, status

from app.core.deps import Estudante, Ong, Sessao
from app.schemas.comum import Pagina
from app.schemas.inscricao import (
    AprovacaoEmLote, InscricaoEntrada, InscricaoSaida, ResultadoDoLote,
)
from app.services import inscricao_service

router = APIRouter(prefix="/inscricoes", tags=["inscricoes"])


@router.post("", response_model=InscricaoSaida, status_code=status.HTTP_201_CREATED)
async def inscrever(
    request: Request, dados: InscricaoEntrada, aluno: Estudante, sessao: Sessao
) -> dict:
    return await inscricao_service.criar(sessao, aluno, dados.atividadeId,
                                         request=request)


@router.get("/minhas", response_model=Pagina[InscricaoSaida])
async def minhas(
    aluno: Estudante, sessao: Sessao,
    grupo: str | None = None,
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(20, ge=1, le=100),
) -> Pagina:
    itens, total = await inscricao_service.listar_minhas(
        sessao, aluno, grupo=grupo, pagina=pagina, tamanho=tamanho
    )
    return Pagina.montar(itens, total, pagina, tamanho)


@router.post("/{inscricao_id}/cancelar", response_model=InscricaoSaida)
async def cancelar(
    request: Request, inscricao_id: uuid.UUID, aluno: Estudante, sessao: Sessao
) -> dict:
    return await inscricao_service.cancelar(sessao, aluno, inscricao_id,
                                            request=request)


@router.post("/{inscricao_id}/aprovar", response_model=InscricaoSaida)
async def aprovar(
    request: Request, inscricao_id: uuid.UUID, ong: Ong, sessao: Sessao
) -> dict:
    return await inscricao_service.responder(sessao, ong, inscricao_id, True,
                                             request=request)


@router.post("/{inscricao_id}/recusar", response_model=InscricaoSaida)
async def recusar(
    request: Request, inscricao_id: uuid.UUID, ong: Ong, sessao: Sessao
) -> dict:
    """Recusa **sem motivo** (D8) — o aluno vê apenas "Não aprovada"."""
    return await inscricao_service.responder(sessao, ong, inscricao_id, False,
                                             request=request)


@router.post("/aprovar-lote", response_model=ResultadoDoLote)
async def aprovar_lote(
    request: Request, dados: AprovacaoEmLote, ong: Ong, sessao: Sessao
) -> dict:
    return await inscricao_service.aprovar_em_lote(sessao, ong, dados.ids,
                                                   request=request)
