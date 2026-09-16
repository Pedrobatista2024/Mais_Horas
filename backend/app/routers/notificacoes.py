"""Rotas de notificação — `/api/v1/notificacoes`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.core.deps import Sessao, UsuarioAtual
from app.schemas.comum import Pagina
from app.schemas.notificacao import Contador, MarcadasSaida, NotificacaoSaida
from app.services import notificacao_service

router = APIRouter(prefix="/notificacoes", tags=["notificacoes"])


@router.get("", response_model=Pagina[NotificacaoSaida])
async def listar(
    usuario: UsuarioAtual, sessao: Sessao,
    apenasNaoLidas: bool = False,
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(20, ge=1, le=100),
) -> Pagina:
    itens, total = await notificacao_service.listar(
        sessao, usuario, apenas_nao_lidas=apenasNaoLidas,
        pagina=pagina, tamanho=tamanho)
    return Pagina.montar(itens, total, pagina, tamanho)


@router.get("/contador", response_model=Contador)
async def contador(usuario: UsuarioAtual, sessao: Sessao) -> dict:
    """Só o número, para o sino. O cliente consulta com frequência."""
    return {"naoLidas": await notificacao_service.contar_nao_lidas(sessao, usuario)}


@router.post("/lidas", response_model=MarcadasSaida)
async def marcar_todas(usuario: UsuarioAtual, sessao: Sessao) -> dict:
    return {"marcadas": await notificacao_service.marcar_todas(sessao, usuario)}


@router.post("/{notificacao_id}/lida", response_model=NotificacaoSaida)
async def marcar_lida(notificacao_id: uuid.UUID, usuario: UsuarioAtual,
                      sessao: Sessao) -> dict:
    return await notificacao_service.marcar_lida(sessao, usuario, notificacao_id)
