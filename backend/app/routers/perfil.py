"""Rotas de perfil — `/api/v1/perfil` e `/api/v1/usuarios`."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Request, UploadFile

from app.core.deps import Sessao, UsuarioAtual
from app.schemas.perfil import (
    NomeEntrada, PerfilEstudanteEntrada, PerfilOngEntrada, PerfilPublicoSaida,
    PerfilSaida,
)
from app.services import perfil_service

router = APIRouter(tags=["perfil"])


class _EntradaEstudante(PerfilEstudanteEntrada, NomeEntrada):
    """Perfil de estudante mais o nome de exibição, que vive em `usuarios`."""


class _EntradaOng(PerfilOngEntrada, NomeEntrada):
    """Perfil de ONG mais o nome de exibição."""


@router.get("/perfil", response_model=PerfilSaida)
async def obter_perfil(usuario: UsuarioAtual, sessao: Sessao) -> dict:
    return await perfil_service.obter(sessao, usuario)


@router.put("/perfil", response_model=PerfilSaida)
async def atualizar_perfil(
    request: Request, usuario: UsuarioAtual, sessao: Sessao,
    dados: _EntradaEstudante | _EntradaOng,
) -> dict:
    # `exclude_unset` preserva a diferença entre "não mexa neste campo" (ausente)
    # e "apague este campo" (presente como nulo).
    corpo = dados.model_dump(exclude_unset=True)
    nome = corpo.pop("nome", None)
    return await perfil_service.atualizar(sessao, usuario, corpo, nome, request=request)


@router.post("/perfil/foto", response_model=PerfilSaida)
async def enviar_foto(
    request: Request, usuario: UsuarioAtual, sessao: Sessao,
    arquivo: Annotated[UploadFile, File(alias="foto")],
) -> dict:
    return await perfil_service.salvar_foto(sessao, usuario, arquivo, request=request)


@router.delete("/perfil/foto", response_model=PerfilSaida)
async def remover_foto(
    request: Request, usuario: UsuarioAtual, sessao: Sessao
) -> dict:
    return await perfil_service.remover_foto(sessao, usuario, request=request)


@router.get("/usuarios/{usuario_id}/publico", response_model=PerfilPublicoSaida)
async def perfil_publico(
    usuario_id: uuid.UUID, _: UsuarioAtual, sessao: Sessao
) -> dict:
    """Exige login para evitar varredura de perfis por quem não usa a plataforma."""
    return await perfil_service.obter_publico(sessao, usuario_id)
