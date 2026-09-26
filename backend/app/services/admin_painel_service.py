"""
Console administrativo — visão geral, auditoria e sistema (A1, A2, A8).

A auditoria é **somente leitura** (RN-33): não existe `PUT` nem `DELETE` para
ela em lugar nenhum da API. A ausência é a garantia.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, time, timedelta, timezone

from fastapi import Request
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria, security
from app.core.config import config
from app.db.models import (
    Atividade, Certificado, Inscricao, PerfilOng, RegistroAuditoria,
    TokenRedefinicaoSenha, TokenSessao, Usuario,
)
from app.services import atividade_service, certificado_service
from app.services.atividade_service import TZ

# Falhas de login em 24 h a partir das quais o painel alerta (A1).
LIMIAR_FALHAS_DE_LOGIN = 20

# Teto da exportação: o CSV é para investigar um recorte, não para copiar a base.
LIMITE_DA_EXPORTACAO = 5000


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _texto(momento: datetime | None) -> str | None:
    return momento.isoformat() if momento else None


async def _contar(sessao: AsyncSession, modelo, *condicoes) -> int:
    return int(await sessao.scalar(
        select(func.count()).select_from(modelo).where(*condicoes)) or 0)


# ===================== Visão geral (A1) =====================


async def visao_geral(sessao: AsyncSession) -> dict:
    agora = _agora()
    semana = agora - timedelta(days=7)
    dia = agora - timedelta(hours=24)

    por_papel = {papel: 0 for papel in ("estudante", "ong", "superadmin")}
    for papel, total in await sessao.execute(
            select(Usuario.papel, func.count()).group_by(Usuario.papel)):
        por_papel[papel] = int(total)

    atividades = {
        situacao: await _contar(
            sessao, Atividade,
            *atividade_service.condicao_de_situacao(situacao))
        for situacao in atividade_service.SITUACOES_FILTRAVEIS
    }

    paradas = await _contar(
        sessao, Atividade,
        *atividade_service.condicao_de_situacao("aguardando_validacao"),
        Atividade.data <= (datetime.now(TZ) - timedelta(days=7)).date())
    falhas = await _contar(sessao, RegistroAuditoria,
                           RegistroAuditoria.acao == "sessao.falha",
                           RegistroAuditoria.ocorrido_em >= dia)
    adulteracoes = await _contar(sessao, RegistroAuditoria,
                                 RegistroAuditoria.acao == "integridade.verificada",
                                 RegistroAuditoria.ocorrido_em >= semana,
                                 RegistroAuditoria.depois["desfecho"].astext
                                 == "adulterado")
    ongs_sem_cnpj = int(await sessao.scalar(
        select(func.count()).select_from(Usuario)
        .outerjoin(PerfilOng, PerfilOng.usuario_id == Usuario.id)
        .where(Usuario.papel == "ong", Usuario.situacao == "ativa",
               or_(PerfilOng.cnpj.is_(None), PerfilOng.cnpj == ""))) or 0)

    alertas = []
    if paradas:
        alertas.append({
            "tipo": "atividades_paradas", "gravidade": "alta", "quantidade": paradas,
            "mensagem": f"{paradas} atividade(s) aguardando validação há mais de 7 dias",
            "link": "/admin/atividades?paradas=1"})
    if adulteracoes:
        alertas.append({
            "tipo": "certificado_adulterado", "gravidade": "critica",
            "quantidade": adulteracoes,
            "mensagem": "Certificado com assinatura inválida foi consultado nos "
                        "últimos 7 dias — indício de escrita direta no banco",
            "link": "/admin/certificados?assinatura=nao_confere"})
    if falhas >= LIMIAR_FALHAS_DE_LOGIN:
        alertas.append({
            "tipo": "pico_de_falhas_de_login", "gravidade": "media",
            "quantidade": falhas,
            "mensagem": f"{falhas} tentativas de login recusadas nas últimas 24 h",
            "link": "/admin/auditoria?acao=sessao.falha"})
    if ongs_sem_cnpj:
        alertas.append({
            "tipo": "ong_sem_cnpj", "gravidade": "baixa", "quantidade": ongs_sem_cnpj,
            "mensagem": f"{ongs_sem_cnpj} organização(ões) ativa(s) sem CNPJ",
            "link": "/admin/ongs"})

    try:
        await sessao.execute(text("SELECT 1"))
        banco_ok = True
    except Exception:  # noqa: BLE001 — é exatamente o que o painel quer saber
        banco_ok = False

    return {
        "contas": {
            "total": sum(por_papel.values()),
            "porPapel": por_papel,
            "novasNaSemana": await _contar(sessao, Usuario, Usuario.criado_em >= semana),
            "suspensas": await _contar(sessao, Usuario, Usuario.situacao == "suspensa"),
        },
        "atividades": atividades,
        "certificados": {
            "emitidos": await _contar(sessao, Certificado),
            "revogados": await _contar(sessao, Certificado,
                                       Certificado.revogado_em.is_not(None)),
        },
        "checkinsUltimas24h": await _contar(sessao, Inscricao,
                                            Inscricao.checkin_em >= dia),
        "saude": {
            "banco": banco_ok,
            "chaveDeAssinatura": bool(config.chave_assinatura),
            "email": config.email_modo,
        },
        "alertas": alertas,
    }


# ===================== Auditoria (A2) =====================


def _filtros_da_auditoria(filtros: dict) -> list:
    condicoes = []
    if filtros.get("de"):
        inicio = datetime.combine(filtros["de"], time.min, tzinfo=TZ)
        condicoes.append(RegistroAuditoria.ocorrido_em >= inicio)
    if filtros.get("ate"):
        # Inclusivo: "até 15/09" quer dizer até o fim do dia 15.
        fim = datetime.combine(filtros["ate"] + timedelta(days=1), time.min, tzinfo=TZ)
        condicoes.append(RegistroAuditoria.ocorrido_em < fim)
    if filtros.get("ator_id"):
        condicoes.append(RegistroAuditoria.ator_id == filtros["ator_id"])
    if filtros.get("alvo_id"):
        # "Tudo sobre esta pessoa": o que ela fez e o que fizeram com ela.
        alvo = filtros["alvo_id"]
        condicoes.append(or_(RegistroAuditoria.ator_id == alvo,
                             RegistroAuditoria.entidade_id == alvo,
                             RegistroAuditoria.em_nome_de_id == alvo))
    if filtros.get("acao"):
        acao = filtros["acao"].strip()
        # "sessao." filtra a família inteira; o nome completo filtra uma ação.
        if acao.endswith("."):
            condicoes.append(RegistroAuditoria.acao.startswith(acao))
        else:
            condicoes.append(RegistroAuditoria.acao == acao)
    if filtros.get("entidade"):
        condicoes.append(RegistroAuditoria.entidade == filtros["entidade"])
    if filtros.get("entidade_id"):
        condicoes.append(RegistroAuditoria.entidade_id == filtros["entidade_id"])
    if filtros.get("ip"):
        condicoes.append(func.host(RegistroAuditoria.ip) == filtros["ip"].strip())
    if filtros.get("apenas_admin"):
        condicoes.append(RegistroAuditoria.ator_papel == "superadmin")
    if filtros.get("apenas_em_nome_de"):
        condicoes.append(RegistroAuditoria.em_nome_de_id.is_not(None))
    return condicoes


def _linha(registro: RegistroAuditoria, nome_ator: str | None,
           nome_em_nome_de: str | None) -> dict:
    return {
        "id": registro.id,
        "ocorridoEm": _texto(registro.ocorrido_em),
        "acao": registro.acao,
        "atorId": str(registro.ator_id) if registro.ator_id else None,
        "atorNome": nome_ator,
        "atorPapel": registro.ator_papel,
        "emNomeDeId": str(registro.em_nome_de_id) if registro.em_nome_de_id else None,
        "emNomeDeNome": nome_em_nome_de,
        "entidade": registro.entidade,
        "entidadeId": str(registro.entidade_id) if registro.entidade_id else None,
        "antes": registro.antes,
        "depois": registro.depois,
        "ip": str(registro.ip) if registro.ip else None,
        "userAgent": registro.user_agent,
    }


def _consulta_da_auditoria(condicoes: list):
    """
    Junta o nome do ator por *outer join*: a auditoria não tem chave
    estrangeira para `usuarios` (a trilha sobrevive à conta), então o nome
    pode não existir mais — e a linha continua aparecendo.
    """
    ator = Usuario.__table__.alias("ator")
    alvo = Usuario.__table__.alias("alvo")
    return (
        select(RegistroAuditoria, ator.c.nome, alvo.c.nome)
        .outerjoin(ator, ator.c.id == RegistroAuditoria.ator_id)
        .outerjoin(alvo, alvo.c.id == RegistroAuditoria.em_nome_de_id)
        .where(*condicoes)
        .order_by(RegistroAuditoria.ocorrido_em.desc(), RegistroAuditoria.id.desc())
    )


async def listar_auditoria(sessao: AsyncSession, admin: Usuario, filtros: dict, *,
                           pagina: int = 1, tamanho: int = 50,
                           request: Request | None = None) -> tuple[list[dict], int]:
    condicoes = _filtros_da_auditoria(filtros)
    total = await _contar(sessao, RegistroAuditoria, *condicoes)
    linhas = await sessao.execute(
        _consulta_da_auditoria(condicoes)
        .offset((pagina - 1) * tamanho).limit(tamanho))
    itens = [_linha(r, nome, alvo) for r, nome, alvo in linhas]

    # Consultar a auditoria também é auditado (FS-02). Só a primeira página:
    # paginar o mesmo recorte não é uma nova consulta.
    if pagina == 1:
        await auditoria.registrar(
            sessao, "auditoria.consultada", ator_id=admin.id,
            ator_papel=admin.papel,
            depois={"filtros": _filtros_legiveis(filtros), "resultados": total},
            request=request)
        await sessao.commit()
    return itens, total


def _filtros_legiveis(filtros: dict) -> dict:
    return {chave: str(valor) for chave, valor in filtros.items()
            if valor not in (None, "", False)}


def _celula(valor) -> str:
    """
    Neutraliza injeção de fórmula: uma célula começando com `=`, `+`, `-` ou
    `@` vira fórmula ao abrir o CSV numa planilha — e o conteúdo vem de campos
    que qualquer usuário preenche, como nome e título.
    """
    texto = "" if valor is None else str(valor)
    if texto[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + texto
    return texto


async def exportar_auditoria(sessao: AsyncSession, admin: Usuario, filtros: dict,
                             *, request: Request | None = None) -> bytes:
    condicoes = _filtros_da_auditoria(filtros)
    linhas = await sessao.execute(
        _consulta_da_auditoria(condicoes).limit(LIMITE_DA_EXPORTACAO))

    saida = io.StringIO()
    escritor = csv.writer(saida, delimiter=";")
    escritor.writerow(["ocorrido_em", "acao", "ator", "ator_papel", "em_nome_de",
                       "entidade", "entidade_id", "antes", "depois", "ip"])
    quantidade = 0
    for registro, nome, alvo in linhas:
        linha = _linha(registro, nome, alvo)
        escritor.writerow([_celula(v) for v in (
            linha["ocorridoEm"], linha["acao"], linha["atorNome"] or linha["atorId"],
            linha["atorPapel"], linha["emNomeDeNome"], linha["entidade"],
            linha["entidadeId"], linha["antes"], linha["depois"], linha["ip"])])
        quantidade += 1

    await auditoria.registrar(
        sessao, "auditoria.exportada", ator_id=admin.id, ator_papel=admin.papel,
        depois={"filtros": _filtros_legiveis(filtros), "linhas": quantidade},
        request=request)
    await sessao.commit()
    # BOM para o Excel reconhecer os acentos.
    return ("﻿" + saida.getvalue()).encode("utf-8")


# ===================== Sistema (A8) =====================


def sistema() -> dict:
    configurada = bool(config.chave_assinatura)
    return {
        "chave": {
            "configurada": configurada,
            "impressaoDigital": (security.impressao_digital_chave()
                                 if configurada else None),
            "algoritmo": "Ed25519",
        },
        "parametros": {
            "janelaDoCheckinSegundos": config.checkin_janela_segundos,
            "folgaDoCheckinSegundos": config.checkin_graca_segundos,
            "accessTokenMinutos": config.access_token_minutos,
            "refreshTokenDias": config.refresh_token_dias,
            "uploadMaximoBytes": config.upload_max_bytes,
            "verificacoesPorMinuto": config.verificacao_por_minuto,
            "inscricoesAtivasMaximo": config.inscricoes_ativas_max,
            "espelhoMinutos": config.espelho_minutos,
            "ambiente": config.ambiente,
        },
    }


async def verificar_integridade(sessao: AsyncSession, admin: Usuario, *,
                                request: Request | None = None) -> dict:
    """
    FS-11 — a contraprova do sistema. Se alguém escreveu direto no banco, é
    aqui que aparece.
    """
    certificado_service.exigir_chave()
    total, divergentes = 0, []
    for cert in await sessao.scalars(select(Certificado).order_by(Certificado.emitido_em)):
        total += 1
        if not certificado_service.assinatura_confere(cert):
            divergentes.append({
                "id": str(cert.id), "codigo": cert.codigo_verificacao,
                "aluno": cert.nome_no_certificado,
                "atividade": cert.titulo_atividade,
            })

    await auditoria.registrar(
        sessao, "integridade.verificada", ator_id=admin.id, ator_papel=admin.papel,
        depois={"desfecho": "adulterado" if divergentes else "integro",
                "total": total, "divergentes": len(divergentes),
                "codigos": [d["codigo"] for d in divergentes][:50]},
        request=request)
    await sessao.commit()
    return {"verificadoEm": _texto(_agora()), "total": total,
            "validos": total - len(divergentes), "divergentes": divergentes}


def chave_publica() -> bytes:
    certificado_service.exigir_chave()
    return security.chave_publica_pem().encode()


async def limpar_tokens(sessao: AsyncSession, admin: Usuario, *,
                        request: Request | None = None) -> dict:
    """
    Remove o que já venceu. Token de sessão revogado mas ainda no prazo
    **fica**: é ele que permite detectar a reapresentação de um refresh
    roubado dentro da validade.
    """
    agora = _agora()
    sessoes = await sessao.execute(
        delete(TokenSessao).where(TokenSessao.expira_em < agora))
    redefinicoes = await sessao.execute(
        delete(TokenRedefinicaoSenha).where(TokenRedefinicaoSenha.expira_em < agora))

    resultado = {"sessoes": sessoes.rowcount or 0,
                 "redefinicoes": redefinicoes.rowcount or 0}
    await auditoria.registrar(
        sessao, "sistema.tokens_limpos", ator_id=admin.id, ator_papel=admin.papel,
        depois=resultado, request=request)
    await sessao.commit()
    return resultado

