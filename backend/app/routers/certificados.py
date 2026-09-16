"""Rotas de certificado — `/api/v1/certificados`."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Request, Response, status
from fastapi.responses import JSONResponse

from app.core.deps import Estudante, Sessao, UsuarioAtual
from app.core.rate_limit import limite_de_verificacao
from app.schemas.certificado import PaginaDeCertificados, VerificacaoSaida
from app.services import certificado_service

router = APIRouter(prefix="/certificados", tags=["certificados"])


def _pdf(conteudo: bytes, nome: str) -> Response:
    return Response(
        content=conteudo, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nome}"',
                 "Cache-Control": "no-store"},
    )


@router.get("/meus", response_model=PaginaDeCertificados)
async def meus(
    aluno: Estudante, sessao: Sessao,
    pagina: int = Query(1, ge=1),
    tamanho: int = Query(20, ge=1, le=100),
) -> dict:
    itens, total, horas = await certificado_service.listar_meus(
        sessao, aluno, pagina=pagina, tamanho=tamanho)
    corpo = PaginaDeCertificados.montar(itens, total, pagina, tamanho).model_dump()
    return {**corpo, "horasValidas": horas}


@router.get("/verificar/{codigo}", response_model=VerificacaoSaida,
            dependencies=[Depends(limite_de_verificacao)],
            responses={404: {"model": VerificacaoSaida}})
async def verificar(codigo: str, request: Request, sessao: Sessao):
    """
    Pública. Os quatro desfechos têm corpo completo — inclusive o `inexistente`,
    que sai com 404 mas **não** no formato de erro: a tela mostra o que veio.
    """
    resposta = await certificado_service.verificar(sessao, codigo, request=request)
    if resposta["desfecho"] == "inexistente":
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND,
                            content=VerificacaoSaida(**resposta).model_dump(mode="json"))
    return resposta


@router.get("/verificar/{codigo}/pdf",
            dependencies=[Depends(limite_de_verificacao)])
async def pdf_publico(codigo: str, sessao: Sessao) -> Response:
    return _pdf(*await certificado_service.pdf_publico(sessao, codigo))


# Por último: `/{id}/pdf` casaria com `/verificar/pdf` se viesse antes.
@router.get("/{certificado_id}/pdf")
async def pdf(certificado_id: uuid.UUID, usuario: UsuarioAtual,
              sessao: Sessao) -> Response:
    return _pdf(*await certificado_service.pdf_do_proprio(
        sessao, usuario, certificado_id))
