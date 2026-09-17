"""
Console administrativo — atividades e certificados (A6, A7).

Não existe emissão de certificado aqui (D14). Certificado nasce de presença
confirmada em atividade real; um criado à mão pelo admin teria assinatura
válida sem lastro nenhum e derrubaria a história anti-fraude inteira.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import auditoria
from app.core.errors import ErroDeNegocio
from app.db.models import Atividade, Certificado, Usuario
from app.services import atividade_service, certificado_service, checkin_service
from app.services.atividade_service import TZ, agora, situacao_real

# FS-08 — a ONG tem uma semana para validar antes de o admin poder destravar.
PRAZO_DA_ONG = timedelta(days=7)

POLITICAS = ("checkin_presente", "todos_ausentes")


# ===================== Atividades (A6) =====================


async def _buscar_atividade(sessao: AsyncSession, atividade_id: uuid.UUID) -> Atividade:
    atividade = await sessao.scalar(
        select(Atividade).where(Atividade.id == atividade_id)
        .options(selectinload(Atividade.ong)))
    if atividade is None:
        raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                            status.HTTP_404_NOT_FOUND)
    return atividade


def _fim_da_atividade(atividade: Atividade) -> datetime:
    return datetime.combine(atividade.data, atividade.hora_fim, tzinfo=TZ)


def parada_ha_muito(atividade: Atividade) -> bool:
    return (situacao_real(atividade) == "aguardando_validacao"
            and agora() - _fim_da_atividade(atividade) >= PRAZO_DA_ONG)


async def listar_atividades(
    sessao: AsyncSession, *, situacao: str | None = None,
    ong_id: uuid.UUID | None = None, busca: str | None = None,
    apenas_paradas: bool = False, pagina: int = 1, tamanho: int = 20,
) -> tuple[list[dict], int]:
    condicoes = []
    if situacao:
        # Reaproveita a tradução das abas de O2, que já sabe separar as
        # situações calculadas no próprio SQL.
        condicoes += atividade_service._condicao_de_situacao(situacao)
    if ong_id:
        condicoes.append(Atividade.ong_id == ong_id)
    if busca and busca.strip():
        alvo = f"%{busca.strip()}%"
        condicoes.append(or_(Atividade.titulo.ilike(alvo),
                             Atividade.cidade.ilike(alvo),
                             Atividade.local.ilike(alvo)))
    if apenas_paradas:
        limite = (agora() - PRAZO_DA_ONG).date()
        condicoes += atividade_service._condicao_de_situacao("aguardando_validacao")
        condicoes.append(Atividade.data <= limite)

    total = int(await sessao.scalar(
        select(func.count()).select_from(Atividade).where(*condicoes)) or 0)
    resultado = await sessao.scalars(
        select(Atividade).where(*condicoes)
        .options(selectinload(Atividade.ong))
        .order_by(Atividade.data.desc(), Atividade.criado_em.desc())
        .offset((pagina - 1) * tamanho).limit(tamanho))

    itens = []
    for atividade in resultado:
        corpo = await atividade_service.serializar(sessao, atividade)
        corpo["podeForcarValidacao"] = parada_ha_muito(atividade)
        itens.append(corpo)
    return itens, total


async def editar_atividade(sessao: AsyncSession, admin: Usuario,
                           atividade_id: uuid.UUID, dados: dict, *,
                           request: Request | None = None) -> dict:
    """
    FS-07. Sem a trava da RN-12 — o admin existe para corrigir o que a ONG
    não corrige —, mas **visível**: a atividade passa a exibir "editada pela
    administração" para a ONG e para os inscritos (RN-35).
    """
    atividade = await _buscar_atividade(sessao, atividade_id)
    ocupadas, mudou = await atividade_service.aplicar_edicao(
        sessao, atividade, admin, dados, travar_com_inscritos=False,
        acao="atividade.editada_por_admin", request=request)
    if mudou:
        atividade.editada_por_admin_em = agora()
    await sessao.commit()
    return await atividade_service.serializar(sessao, atividade, ocupadas=ocupadas)


async def cancelar_atividade(sessao: AsyncSession, admin: Usuario,
                             atividade_id: uuid.UUID, motivo: str, *,
                             request: Request | None = None) -> dict:
    """
    Só antes do fim. Cancelar uma atividade que já aconteceu negaria o
    certificado de quem foi; para essas, o caminho é forçar a validação.
    """
    atividade = await _buscar_atividade(sessao, atividade_id)
    if situacao_real(atividade) not in ("rascunho", "publicada", "em_andamento"):
        raise ErroDeNegocio(
            "situacao_invalida",
            "Só é possível cancelar atividade que ainda não terminou")
    await atividade_service.encerrar_por_cancelamento(
        sessao, atividade, admin, motivo.strip(), request=request)
    await sessao.commit()
    return await atividade_service.serializar(sessao, atividade)


async def forcar_validacao(sessao: AsyncSession, admin: Usuario,
                           atividade_id: uuid.UUID, motivo: str, politica: str,
                           *, request: Request | None = None) -> dict:
    """
    FS-08 — destrava a ONG inerte, que de outro modo deixaria os alunos sem o
    certificado que ganharam.

    A política vale **só para quem ainda está sem decisão**: o que a ONG já
    tiver marcado é respeitado. Com `checkin_presente`, a evidência do QR vira
    presença; sem check-in, vira ausência.
    """
    atividade = await _buscar_atividade(sessao, atividade_id)
    if situacao_real(atividade) != "aguardando_validacao":
        raise ErroDeNegocio("situacao_invalida",
                            "A atividade não está aguardando validação")
    if not parada_ha_muito(atividade):
        raise ErroDeNegocio(
            "prazo_da_ong",
            "A organização ainda está no prazo de 7 dias para validar")
    if politica not in POLITICAS:
        raise ErroDeNegocio("politica_invalida", "Política de validação inválida")

    inscritos = await checkin_service._inscritos(sessao, atividade.id)
    if politica == "checkin_presente" and not any(i.checkin_em for i in inscritos):
        raise ErroDeNegocio(
            "sem_checkin",
            "Ninguém registrou check-in. A única política possível é marcar "
            "todos como ausentes")

    decididas = 0
    for inscricao in inscritos:
        if inscricao.situacao in ("presente", "ausente"):
            continue
        presente = politica == "checkin_presente" and inscricao.checkin_em is not None
        inscricao.situacao = "presente" if presente else "ausente"
        inscricao.presenca_validada_em = agora()
        inscricao.presenca_validada_por = admin.id
        decididas += 1

    await auditoria.registrar(
        sessao, "atividade.validacao_forcada", ator_id=admin.id,
        ator_papel=admin.papel, entidade="atividade", entidade_id=atividade.id,
        depois={"motivo": motivo.strip(), "politica": politica,
                "decididas_pelo_admin": decididas},
        request=request)
    return await checkin_service.concluir(sessao, atividade, admin, request=request)


# ===================== Certificados (A7) =====================


async def listar_certificados(
    sessao: AsyncSession, *, busca: str | None = None,
    situacao: str | None = None, assinatura: str | None = None,
    pagina: int = 1, tamanho: int = 20,
) -> tuple[list[dict], int]:
    """
    A situação da assinatura só existe depois de recalculada, então o filtro
    por ela percorre o recorte inteiro antes de paginar. Na escala do projeto
    é barato — Ed25519 confere milhares por segundo —, e é o único jeito de o
    total da página não mentir.
    """
    condicoes = []
    if busca and busca.strip():
        alvo = f"%{busca.strip()}%"
        condicoes.append(or_(
            Certificado.codigo_verificacao.ilike(alvo),
            Certificado.nome_no_certificado.ilike(alvo),
            Certificado.nome_organizacao.ilike(alvo),
            Certificado.titulo_atividade.ilike(alvo)))
    if situacao == "validos":
        condicoes.append(Certificado.revogado_em.is_(None))
    elif situacao == "revogados":
        condicoes.append(Certificado.revogado_em.is_not(None))

    consulta = (select(Certificado).where(*condicoes)
                .order_by(Certificado.emitido_em.desc(), Certificado.id))

    if assinatura in ("confere", "nao_confere"):
        querido = assinatura == "confere"
        todos = [c for c in await sessao.scalars(consulta)
                 if certificado_service.assinatura_confere(c) == querido]
        inicio = (pagina - 1) * tamanho
        pagina_de = todos[inicio:inicio + tamanho]
        total = len(todos)
    else:
        total = int(await sessao.scalar(
            select(func.count()).select_from(Certificado).where(*condicoes)) or 0)
        pagina_de = list(await sessao.scalars(
            consulta.offset((pagina - 1) * tamanho).limit(tamanho)))

    return [{**certificado_service.serializar(c),
             "assinaturaConfere": certificado_service.assinatura_confere(c),
             "motivoRevogacao": c.motivo_revogacao}
            for c in pagina_de], total


async def reconferir(sessao: AsyncSession, certificado_id: uuid.UUID) -> dict:
    cert = await sessao.get(Certificado, certificado_id)
    if cert is None:
        raise ErroDeNegocio("nao_encontrado", "Certificado não encontrado",
                            status.HTTP_404_NOT_FOUND)
    return {"id": str(cert.id),
            "assinaturaConfere": certificado_service.assinatura_confere(cert)}

