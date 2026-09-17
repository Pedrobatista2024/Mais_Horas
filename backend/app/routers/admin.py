"""
Rotas do console administrativo — `/api/v1/admin`. Todas exigem `superadmin`.

As ausências também são contrato: **não há** rota para definir senha (RN-28),
para trocar e-mail, para emitir certificado (D14) nem para alterar ou apagar a
auditoria (RN-33).
"""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Query, Request, Response

from app.core.deps import Admin, Sessao
from app.schemas.admin import (
    DetalheUsuario, ForcarValidacao, MotivoObrigatorio, NovoAdmin, OngAdmin,
    RegistroDeAuditoria, RelatorioDeIntegridade, ResumoUsuario, SuspensaoSaida,
    VisaoGeral,
)
from app.schemas.atividade import AtividadeEdicao
from app.schemas.certificado import CertificadoSaida, RevogacaoEntrada
from app.schemas.checkin import FinalizacaoSaida
from app.schemas.comum import Pagina
from app.services import admin_contas_service as contas
from app.services import admin_conteudo_service as conteudo
from app.services import admin_painel_service as painel
from app.services import certificado_service

router = APIRouter(prefix="/admin", tags=["admin"])


# ===================== Visão geral e auditoria =====================


@router.get("/visao-geral", response_model=VisaoGeral)
async def visao_geral(admin: Admin, sessao: Sessao) -> dict:
    return await painel.visao_geral(sessao)


def _filtros(de, ate, atorId, alvoId, acao, entidade, entidadeId, ip,
             apenasAdmin, apenasEmNomeDe) -> dict:
    return {"de": de, "ate": ate, "ator_id": atorId, "alvo_id": alvoId,
            "acao": acao, "entidade": entidade, "entidade_id": entidadeId,
            "ip": ip, "apenas_admin": apenasAdmin,
            "apenas_em_nome_de": apenasEmNomeDe}


@router.get("/auditoria", response_model=Pagina[RegistroDeAuditoria])
async def auditoria(
    request: Request, admin: Admin, sessao: Sessao,
    de: date | None = None, ate: date | None = None,
    atorId: uuid.UUID | None = None, alvoId: uuid.UUID | None = None,
    acao: str | None = None, entidade: str | None = None,
    entidadeId: uuid.UUID | None = None, ip: str | None = None,
    apenasAdmin: bool = False, apenasEmNomeDe: bool = False,
    pagina: int = Query(1, ge=1), tamanho: int = Query(50, ge=1, le=200),
) -> Pagina:
    filtros = _filtros(de, ate, atorId, alvoId, acao, entidade, entidadeId, ip,
                       apenasAdmin, apenasEmNomeDe)
    itens, total = await painel.listar_auditoria(
        sessao, admin, filtros, pagina=pagina, tamanho=tamanho, request=request)
    return Pagina.montar(itens, total, pagina, tamanho)


@router.get("/auditoria/exportar")
async def exportar_auditoria(
    request: Request, admin: Admin, sessao: Sessao,
    de: date | None = None, ate: date | None = None,
    atorId: uuid.UUID | None = None, alvoId: uuid.UUID | None = None,
    acao: str | None = None, entidade: str | None = None,
    entidadeId: uuid.UUID | None = None, ip: str | None = None,
    apenasAdmin: bool = False, apenasEmNomeDe: bool = False,
) -> Response:
    filtros = _filtros(de, ate, atorId, alvoId, acao, entidade, entidadeId, ip,
                       apenasAdmin, apenasEmNomeDe)
    arquivo = await painel.exportar_auditoria(sessao, admin, filtros, request=request)
    return Response(
        content=arquivo, media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="auditoria.csv"',
                 "Cache-Control": "no-store"})


# ===================== Usuários =====================


@router.get("/usuarios", response_model=Pagina[ResumoUsuario])
async def usuarios(
    admin: Admin, sessao: Sessao,
    papel: str | None = None, situacao: str | None = None,
    busca: str | None = None,
    pagina: int = Query(1, ge=1), tamanho: int = Query(20, ge=1, le=100),
) -> Pagina:
    itens, total = await contas.listar(
        sessao, papel=papel, situacao=situacao, busca=busca,
        pagina=pagina, tamanho=tamanho)
    return Pagina.montar(itens, total, pagina, tamanho)


@router.post("/administradores", response_model=ResumoUsuario, status_code=201)
async def criar_admin(request: Request, dados: NovoAdmin, admin: Admin,
                      sessao: Sessao) -> dict:
    return await contas.criar_admin(sessao, admin, dados.nome, dados.email,
                                    dados.senhaAtual, request=request)


@router.get("/usuarios/{usuario_id}", response_model=DetalheUsuario)
async def usuario(request: Request, usuario_id: uuid.UUID, admin: Admin,
                  sessao: Sessao) -> dict:
    return await contas.detalhar(sessao, admin, usuario_id, request=request)


@router.post("/usuarios/{usuario_id}/redefinir-senha")
async def redefinir_senha(request: Request, usuario_id: uuid.UUID, admin: Admin,
                          sessao: Sessao) -> dict:
    return await contas.redefinir_senha(sessao, admin, usuario_id, request=request)


@router.post("/usuarios/{usuario_id}/suspender", response_model=SuspensaoSaida)
async def suspender(request: Request, usuario_id: uuid.UUID,
                    dados: MotivoObrigatorio, admin: Admin, sessao: Sessao) -> dict:
    return await contas.suspender(sessao, admin, usuario_id, dados.motivo,
                                  request=request)


@router.post("/usuarios/{usuario_id}/reativar", response_model=ResumoUsuario)
async def reativar(request: Request, usuario_id: uuid.UUID, admin: Admin,
                   sessao: Sessao) -> dict:
    return await contas.reativar(sessao, admin, usuario_id, request=request)


@router.post("/usuarios/{usuario_id}/encerrar-sessoes")
async def encerrar_sessoes(request: Request, usuario_id: uuid.UUID, admin: Admin,
                           sessao: Sessao) -> dict:
    return await contas.encerrar_sessoes(sessao, admin, usuario_id, request=request)


# ===================== ONGs =====================


@router.get("/ongs", response_model=Pagina[OngAdmin])
async def ongs(
    admin: Admin, sessao: Sessao, busca: str | None = None,
    verificada: bool | None = None,
    pagina: int = Query(1, ge=1), tamanho: int = Query(20, ge=1, le=100),
) -> Pagina:
    itens, total = await contas.listar_ongs(
        sessao, busca=busca, verificada=verificada, pagina=pagina, tamanho=tamanho)
    return Pagina.montar(itens, total, pagina, tamanho)


@router.post("/ongs/{ong_id}/verificar")
async def verificar_ong(request: Request, ong_id: uuid.UUID, admin: Admin,
                        sessao: Sessao) -> dict:
    return await contas.definir_verificacao(sessao, admin, ong_id, True,
                                            request=request)


@router.delete("/ongs/{ong_id}/verificar")
async def remover_verificacao(request: Request, ong_id: uuid.UUID, admin: Admin,
                              sessao: Sessao) -> dict:
    return await contas.definir_verificacao(sessao, admin, ong_id, False,
                                            request=request)


# ===================== Atividades =====================


@router.get("/atividades")
async def atividades(
    admin: Admin, sessao: Sessao, situacao: str | None = None,
    ongId: uuid.UUID | None = None, busca: str | None = None,
    paradas: bool = False,
    pagina: int = Query(1, ge=1), tamanho: int = Query(20, ge=1, le=100),
) -> dict:
    itens, total = await conteudo.listar_atividades(
        sessao, situacao=situacao, ong_id=ongId, busca=busca,
        apenas_paradas=paradas, pagina=pagina, tamanho=tamanho)
    return Pagina.montar(itens, total, pagina, tamanho).model_dump()


@router.put("/atividades/{atividade_id}")
async def editar_atividade(request: Request, atividade_id: uuid.UUID,
                           dados: AtividadeEdicao, admin: Admin,
                           sessao: Sessao) -> dict:
    return await conteudo.editar_atividade(
        sessao, admin, atividade_id, dados.model_dump(exclude_unset=True),
        request=request)


@router.post("/atividades/{atividade_id}/cancelar")
async def cancelar_atividade(request: Request, atividade_id: uuid.UUID,
                             dados: MotivoObrigatorio, admin: Admin,
                             sessao: Sessao) -> dict:
    return await conteudo.cancelar_atividade(sessao, admin, atividade_id,
                                             dados.motivo, request=request)


@router.post("/atividades/{atividade_id}/forcar-validacao",
             response_model=FinalizacaoSaida)
async def forcar_validacao(request: Request, atividade_id: uuid.UUID,
                           dados: ForcarValidacao, admin: Admin,
                           sessao: Sessao) -> dict:
    return await conteudo.forcar_validacao(
        sessao, admin, atividade_id, dados.motivo, dados.politica, request=request)


# ===================== Certificados =====================


@router.get("/certificados")
async def certificados(
    admin: Admin, sessao: Sessao, busca: str | None = None,
    situacao: str | None = None, situacaoAssinatura: str | None = None,
    pagina: int = Query(1, ge=1), tamanho: int = Query(20, ge=1, le=100),
) -> dict:
    itens, total = await conteudo.listar_certificados(
        sessao, busca=busca, situacao=situacao, assinatura=situacaoAssinatura,
        pagina=pagina, tamanho=tamanho)
    return Pagina.montar(itens, total, pagina, tamanho).model_dump()


@router.post("/certificados/{certificado_id}/reconferir")
async def reconferir(certificado_id: uuid.UUID, admin: Admin, sessao: Sessao) -> dict:
    return await conteudo.reconferir(sessao, certificado_id)


@router.post("/certificados/{certificado_id}/revogar",
             response_model=CertificadoSaida)
async def revogar(
    request: Request, certificado_id: uuid.UUID, dados: RevogacaoEntrada,
    admin: Admin, sessao: Sessao,
) -> dict:
    return await certificado_service.revogar(
        sessao, admin, certificado_id, dados.motivo, request=request)


@router.post("/certificados/{certificado_id}/reverter-revogacao",
             response_model=CertificadoSaida)
async def reverter(
    request: Request, certificado_id: uuid.UUID, admin: Admin, sessao: Sessao,
) -> dict:
    return await certificado_service.reverter_revogacao(
        sessao, admin, certificado_id, request=request)


# ===================== Sistema =====================


@router.get("/sistema")
async def sistema(admin: Admin) -> dict:
    return painel.sistema()


@router.post("/sistema/verificar-integridade", response_model=RelatorioDeIntegridade)
async def verificar_integridade(request: Request, admin: Admin,
                                sessao: Sessao) -> dict:
    return await painel.verificar_integridade(sessao, admin, request=request)


@router.get("/sistema/chave-publica")
async def chave_publica(admin: Admin) -> Response:
    return Response(
        content=painel.chave_publica(), media_type="application/x-pem-file",
        headers={"Content-Disposition":
                 'attachment; filename="mais-horas-chave-publica.pem"'})


@router.post("/sistema/limpar-tokens")
async def limpar_tokens(request: Request, admin: Admin, sessao: Sessao) -> dict:
    return await painel.limpar_tokens(sessao, admin, request=request)
