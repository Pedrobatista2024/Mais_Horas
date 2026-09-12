"""Rotas de atividade — `/api/v1/atividades`."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.core.deps import Ong, Sessao, UsuarioAtual, usuario_atual
from app.schemas.atividade import (
    AtividadeEdicao, AtividadeEntrada, AtividadeSaida, MotivoEntrada,
)
from app.schemas.comum import Pagina
from app.services import atividade_service

router = APIRouter(prefix="/atividades", tags=["atividades"])


async def _visitante_ou_usuario(request: Request, sessao: Sessao):
    """
    A vitrine é pública, mas quem está logado recebe `minhaInscricao` em cada
    cartão — é o que define qual botão o item mostra.
    """
    if not request.headers.get("authorization"):
        return None
    try:
        return await usuario_atual(request, sessao)
    except Exception:
        return None


Opcional = Annotated[object, Depends(_visitante_ou_usuario)]


@router.get("", response_model=Pagina[AtividadeSaida])
async def vitrine(
    sessao: Sessao,
    usuario: Opcional,
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(20, ge=1, le=100),
    busca: str | None = None,
    cidade: str | None = None,
    cargaMin: int | None = Query(None, ge=1),
    cargaMax: int | None = Query(None, ge=1),
    comVaga: bool = False,
) -> Pagina:
    itens, total = await atividade_service.listar_vitrine(
        sessao, usuario=usuario, pagina=pagina, tamanho=tamanho, busca=busca,
        cidade=cidade, carga_min=cargaMin, carga_max=cargaMax, com_vaga=comVaga,
    )
    return Pagina.montar(itens, total, pagina, tamanho)


@router.get("/minhas", response_model=Pagina[AtividadeSaida])
async def minhas(
    ong: Ong, sessao: Sessao,
    situacao: str | None = None,
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(20, ge=1, le=100),
) -> Pagina:
    itens, total = await atividade_service.listar_da_ong(
        sessao, ong, situacao=situacao, pagina=pagina, tamanho=tamanho
    )
    return Pagina.montar(itens, total, pagina, tamanho)


@router.get("/{atividade_id}", response_model=AtividadeSaida)
async def detalhe(
    atividade_id: uuid.UUID, sessao: Sessao, usuario: Opcional
) -> dict:
    return await atividade_service.detalhar(sessao, atividade_id, usuario=usuario)


@router.post("", response_model=AtividadeSaida, status_code=status.HTTP_201_CREATED)
async def criar(
    request: Request, dados: AtividadeEntrada, ong: Ong, sessao: Sessao
) -> dict:
    return await atividade_service.criar(sessao, ong, dados.model_dump(),
                                         request=request)


@router.put("/{atividade_id}", response_model=AtividadeSaida)
async def editar(
    request: Request, atividade_id: uuid.UUID, dados: AtividadeEdicao,
    ong: Ong, sessao: Sessao,
) -> dict:
    return await atividade_service.editar(
        sessao, ong, atividade_id, dados.model_dump(exclude_unset=True),
        request=request,
    )


@router.post("/{atividade_id}/publicar", response_model=AtividadeSaida)
async def publicar(
    request: Request, atividade_id: uuid.UUID, ong: Ong, sessao: Sessao
) -> dict:
    return await atividade_service.publicar(sessao, ong, atividade_id, request=request)


@router.post("/{atividade_id}/cancelar", response_model=AtividadeSaida)
async def cancelar(
    request: Request, atividade_id: uuid.UUID, dados: MotivoEntrada,
    ong: Ong, sessao: Sessao,
) -> dict:
    return await atividade_service.cancelar(sessao, ong, atividade_id, dados.motivo,
                                            request=request)


@router.delete("/{atividade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir(
    request: Request, atividade_id: uuid.UUID, ong: Ong, sessao: Sessao
) -> Response:
    await atividade_service.excluir(sessao, ong, atividade_id, request=request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
