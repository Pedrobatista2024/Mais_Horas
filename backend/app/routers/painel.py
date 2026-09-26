"""Painéis de entrada — `/api/v1/painel`. Cada papel enxerga só o seu."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import Estudante, Ong, Sessao
from app.schemas.painel import PainelDaOng, PainelDoEstudante
from app.services import painel_service

router = APIRouter(prefix="/painel", tags=["painel"])


@router.get("/estudante", response_model=PainelDoEstudante)
async def do_estudante(aluno: Estudante, sessao: Sessao) -> dict:
    return await painel_service.do_estudante(sessao, aluno)


@router.get("/ong", response_model=PainelDaOng)
async def da_ong(ong: Ong, sessao: Sessao) -> dict:
    return await painel_service.da_ong(sessao, ong)
