"""
Rotas de autenticação — `/api/v1/auth`.

O refresh token nunca aparece no corpo: é gravado em cookie httpOnly, fora do
alcance de qualquer script da página (RNF-05). Por isso estas rotas montam a
resposta na mão, em vez de devolver o schema direto.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.config import config
from app.core.deps import Sessao
from app.core.errors import ErroDeNegocio
from app.core.rate_limit import limite_de_autenticacao
from app.schemas.auth import (
    CadastroEntrada, EsqueciSenhaEntrada, LoginEntrada, MensagemSaida,
    RedefinirSenhaEntrada, SessaoSaida,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["autenticacao"])

COOKIE_REFRESH = "mh_refresh"
# Restringe o envio do cookie às rotas de sessão — não precisa acompanhar as
# demais chamadas da API.
COOKIE_CAMINHO = "/api/v1/auth"


def _resposta_de_sessao(
    resultado: auth_service.Sessao, status_code: int = status.HTTP_200_OK
) -> Response:
    corpo: dict[str, Any] = {
        "usuario": {
            "id": str(resultado.usuario.id),
            "nome": resultado.usuario.nome,
            "email": resultado.usuario.email,
            "papel": resultado.usuario.papel,
        },
        "token": resultado.token,
        "expiraEm": resultado.expira_em,
    }
    resposta = JSONResponse(status_code=status_code, content=corpo)
    resposta.set_cookie(
        key=COOKIE_REFRESH,
        value=resultado.refresh,
        max_age=config.refresh_token_dias * 24 * 60 * 60,
        httponly=True,
        secure=config.cookie_secure,
        samesite=config.cookie_samesite,
        path=COOKIE_CAMINHO,
    )
    return resposta


@router.post("/cadastro", response_model=SessaoSaida,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(limite_de_autenticacao)])
async def cadastro(request: Request, dados: CadastroEntrada, sessao: Sessao) -> Response:
    resultado = await auth_service.cadastrar(sessao, dados.model_dump(), request=request)
    return _resposta_de_sessao(resultado, status.HTTP_201_CREATED)


@router.post("/entrar", response_model=SessaoSaida,
             dependencies=[Depends(limite_de_autenticacao)])
async def entrar(request: Request, dados: LoginEntrada, sessao: Sessao) -> Response:
    resultado = await auth_service.entrar(sessao, dados.email, dados.senha,
                                          request=request)
    return _resposta_de_sessao(resultado)


@router.post("/renovar", response_model=SessaoSaida)
async def renovar(request: Request, sessao: Sessao) -> Response:
    bruto = request.cookies.get(COOKIE_REFRESH)
    if not bruto:
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida",
                            status.HTTP_401_UNAUTHORIZED)
    resultado = await auth_service.renovar(sessao, bruto, request=request)
    return _resposta_de_sessao(resultado)


@router.post("/sair", response_model=MensagemSaida)
async def sair(request: Request, sessao: Sessao) -> Response:
    await auth_service.sair(sessao, request.cookies.get(COOKIE_REFRESH), request=request)
    resposta = JSONResponse(content={"mensagem": "Sessão encerrada"})
    resposta.delete_cookie(
        key=COOKIE_REFRESH, path=COOKIE_CAMINHO, httponly=True,
        secure=config.cookie_secure, samesite=config.cookie_samesite,
    )
    return resposta


@router.post("/senha/esqueci", response_model=MensagemSaida,
             dependencies=[Depends(limite_de_autenticacao)])
async def esqueci_senha(
    request: Request, dados: EsqueciSenhaEntrada, sessao: Sessao
) -> dict[str, str]:
    await auth_service.pedir_redefinicao(sessao, dados.email, request=request)
    # Resposta idêntica exista ou não a conta (FA-04 E1): a diferença revelaria
    # quais e-mails estão cadastrados.
    return {"mensagem": "Se este e-mail estiver cadastrado, enviaremos as instruções."}


@router.post("/senha/redefinir", response_model=MensagemSaida)
async def redefinir_senha(
    request: Request, dados: RedefinirSenhaEntrada, sessao: Sessao
) -> dict[str, str]:
    await auth_service.redefinir_senha(sessao, dados.token, dados.senha, request=request)
    return {"mensagem": "Senha redefinida. Entre com a nova senha."}
