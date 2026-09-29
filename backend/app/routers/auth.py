"""
Rotas de autenticação — `/api/v1/auth`.

O refresh token nunca aparece no corpo: é gravado em cookie httpOnly, fora do
alcance de qualquer script da página (RNF-05). Por isso estas rotas montam a
resposta na mão, em vez de devolver o schema direto.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse

from app.core.config import config
from app.core.deps import Sessao
from app.core.errors import ErroDeNegocio
from app.core.rate_limit import limite_de_autenticacao
from app.schemas.auth import (
    CadastroEntrada, EsqueciSenhaEntrada, LoginEntrada, MensagemSaida,
    PapelEntrada, RedefinirSenhaEntrada, SessaoSaida,
)
from app.services import auth_service, oauth_service

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


# ===================== Entrada pelo Google (D41) =====================

COOKIE_IDA = "mh_google"
COOKIE_CADASTRO = "mh_google_cadastro"


def _guardar(resposta: Response, nome: str, valor: str, minutos: int) -> None:
    resposta.set_cookie(
        key=nome, value=valor, max_age=minutos * 60, httponly=True,
        secure=config.cookie_secure, samesite=config.cookie_samesite,
        path=COOKIE_CAMINHO)


def _esquecer(resposta: Response, nome: str) -> None:
    resposta.delete_cookie(key=nome, path=COOKIE_CAMINHO, httponly=True,
                           secure=config.cookie_secure,
                           samesite=config.cookie_samesite)


def _voltar(destino: str) -> RedirectResponse:
    return RedirectResponse(f"{config.web_url.rstrip('/')}{destino}",
                            status_code=status.HTTP_303_SEE_OTHER)


@router.get("/provedores")
async def provedores() -> dict:
    """Quais entradas sociais este servidor oferece — a tela pergunta antes."""
    return {"google": oauth_service.disponivel()}


@router.get("/google/inicio", dependencies=[Depends(limite_de_autenticacao)])
async def google_inicio() -> Response:
    url, estado = oauth_service.comecar()
    resposta = RedirectResponse(url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    _guardar(resposta, COOKIE_IDA, estado, oauth_service.MINUTOS_DE_IDA)
    return resposta


@router.get("/google/retorno")
async def google_retorno(
    request: Request, sessao: Sessao,
    code: str | None = None, state: str | None = None, error: str | None = None,
) -> Response:
    """
    Onde o Google devolve a pessoa. Nada de token na URL: a sessão sai no
    mesmo cookie httpOnly de sempre, e a tela seguinte só a recolhe.
    """
    if error or not code or not state:
        return _voltar("/entrar?google=cancelado")

    try:
        guardado = oauth_service.ler_ida(request.cookies.get(COOKIE_IDA), state)
        identidade = await oauth_service.identidade_do_codigo(
            code, guardado["verificador"])
        resultado = await oauth_service.entrar(sessao, identidade, request=request)
    except ErroDeNegocio as erro:
        return _voltar(f"/entrar?google={erro.codigo}")

    if isinstance(resultado, str):
        # Conta nova: falta escolher o papel. O pendente vai em cookie, não na
        # URL — endereço vaza em histórico, log de proxy e print de tela.
        resposta = _voltar("/entrar/google?novo=1")
        _guardar(resposta, COOKIE_CADASTRO, resultado,
                 oauth_service.MINUTOS_DE_CADASTRO)
        _esquecer(resposta, COOKIE_IDA)
        return resposta

    resposta = _voltar("/entrar/google")
    resposta.set_cookie(
        key=COOKIE_REFRESH, value=resultado.refresh,
        max_age=config.refresh_token_dias * 24 * 60 * 60, httponly=True,
        secure=config.cookie_secure, samesite=config.cookie_samesite,
        path=COOKIE_CAMINHO)
    _esquecer(resposta, COOKIE_IDA)
    return resposta


@router.post("/google/concluir", response_model=SessaoSaida,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(limite_de_autenticacao)])
async def google_concluir(request: Request, dados: PapelEntrada,
                          sessao: Sessao) -> Response:
    resultado = await oauth_service.concluir_cadastro(
        sessao, request.cookies.get(COOKIE_CADASTRO), dados.papel, request=request)
    resposta = _resposta_de_sessao(resultado, status.HTTP_201_CREATED)
    _esquecer(resposta, COOKIE_CADASTRO)
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
