"""Rotas de check-in e validação de presença."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request

from app.core.deps import Estudante, Ong, Sessao
from app.schemas.checkin import (
    CheckinEntrada, CheckinManualEntrada, CheckinSaida, FinalizacaoSaida,
    LinhaDePresenca, LoteSaida, PainelSaida, PresencaEntrada, PresencasEmLote,
    TokenDoPainel, ValidacaoSaida,
)
from app.services import checkin_service

# Duas famílias de rota convivem aqui: o que a ONG faz na atividade e o que o
# aluno faz com o código lido.
router = APIRouter(tags=["checkin"])


# ===================== Painel da ONG (O6) =====================


@router.get("/atividades/{atividade_id}/checkin/token", response_model=TokenDoPainel)
async def token(
    request: Request, atividade_id: uuid.UUID, ong: Ong, sessao: Sessao
) -> dict:
    """Token atual do QR. O cliente rebusca quando `validoPor` acabar."""
    return await checkin_service.token_do_painel(sessao, ong, atividade_id,
                                                 request=request)


@router.get("/atividades/{atividade_id}/checkin/painel", response_model=PainelSaida)
async def painel(atividade_id: uuid.UUID, ong: Ong, sessao: Sessao) -> dict:
    return await checkin_service.painel(sessao, ong, atividade_id)


@router.post("/atividades/{atividade_id}/checkin/manual",
             response_model=LinhaDePresenca)
async def manual(
    request: Request, atividade_id: uuid.UUID, dados: CheckinManualEntrada,
    ong: Ong, sessao: Sessao,
) -> dict:
    return await checkin_service.registrar_manual(
        sessao, ong, atividade_id, dados.inscricaoId, request=request)


# ===================== Check-in do aluno (E5) =====================


@router.post("/checkin", response_model=CheckinSaida)
async def registrar(
    request: Request, dados: CheckinEntrada, aluno: Estudante, sessao: Sessao
) -> dict:
    return await checkin_service.registrar(
        sessao, aluno, dados.token, latitude=dados.latitude,
        longitude=dados.longitude, request=request)


# ===================== Validação de presença (O7) =====================


@router.get("/atividades/{atividade_id}/presencas", response_model=ValidacaoSaida)
async def presencas(atividade_id: uuid.UUID, ong: Ong, sessao: Sessao) -> dict:
    return await checkin_service.listar_para_validacao(sessao, ong, atividade_id)


@router.put("/inscricoes/{inscricao_id}/presenca", response_model=LinhaDePresenca)
async def definir_presenca(
    request: Request, inscricao_id: uuid.UUID, dados: PresencaEntrada,
    ong: Ong, sessao: Sessao,
) -> dict:
    return await checkin_service.definir_presenca(
        sessao, ong, inscricao_id, dados.situacao, request=request)


@router.put("/atividades/{atividade_id}/presencas", response_model=LoteSaida)
async def definir_presencas(
    request: Request, atividade_id: uuid.UUID, dados: PresencasEmLote,
    ong: Ong, sessao: Sessao,
) -> dict:
    """Atende "marcar todos os check-ins" e "marcar restantes" numa requisição."""
    return await checkin_service.definir_presencas_em_lote(
        sessao, ong, atividade_id,
        [d.model_dump() for d in dados.decisoes], request=request)


@router.post("/atividades/{atividade_id}/finalizar", response_model=FinalizacaoSaida)
async def finalizar(
    request: Request, atividade_id: uuid.UUID, ong: Ong, sessao: Sessao
) -> dict:
    return await checkin_service.finalizar(sessao, ong, atividade_id,
                                           request=request)
