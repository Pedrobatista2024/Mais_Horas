"""
Notificações dentro do sistema (D16).

`notificar()` **não dá commit**: entra na transação de quem a chamou. Se a
aprovação, o cancelamento ou a emissão forem revertidos, o aviso some junto —
avisar de algo que não aconteceu seria pior que não avisar.

O envio por e-mail entra depois reaproveitando esta mesma tabela: o registro já
é criado hoje, falta só o disparo.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErroDeNegocio
from app.db.models import Notificacao, Usuario


def agora() -> datetime:
    # Relógio próprio, e não o de atividade_service: aquele módulo importa este,
    # e importar de volta criaria um ciclo.
    return datetime.now(timezone.utc)


# Catálogo fechado, como o da auditoria: tipo fora dele é erro de programação,
# não algo para gravar em silêncio.
TIPOS = {
    "inscricao.aprovada",
    "inscricao.recusada",
    "atividade.cancelada",
    "certificado.emitido",
    "certificado.revogado",
    "certificado.restabelecido",
}


def _link_seguro(link: str | None) -> str | None:
    """
    Só caminho interno. O frontend navega para o que vier aqui, e um link
    absoluto transformaria o sino num redirecionamento para fora do sistema.
    """
    if link and link.startswith("/") and not link.startswith("//"):
        return link[:200]
    return None


async def notificar(sessao: AsyncSession, destinatario_id: uuid.UUID, tipo: str,
                    titulo: str, mensagem: str, link: str | None = None) -> None:
    if tipo not in TIPOS:
        raise ValueError(f"Tipo de notificação fora do catálogo: {tipo}")
    # A hora vem daqui, não do `NOW()` do banco: lá ela é a do início da
    # transação, e avisos criados juntos empatariam — a ordem na lista viraria
    # sorteio.
    sessao.add(Notificacao(
        destinatario_id=destinatario_id, tipo=tipo,
        titulo=titulo[:120], mensagem=mensagem[:400], link=_link_seguro(link),
        criado_em=agora(),
    ))


# ===================== Textos =====================
#
# Ficam aqui, e não espalhados pelos serviços, para o tom ser um só. As regras
# de silêncio moram nestes textos: recusa sem motivo (D8) e cancelamento sem o
# motivo que a ONG escreveu para a auditoria (D10).


async def inscricao_respondida(sessao: AsyncSession, aluno_id: uuid.UUID,
                               titulo_atividade: str, aprovada: bool) -> None:
    if aprovada:
        await notificar(
            sessao, aluno_id, "inscricao.aprovada",
            "Inscrição aprovada",
            f"Sua inscrição em “{titulo_atividade}” foi aprovada. Sua vaga está "
            "garantida.",
            "/minhas-inscricoes")
    else:
        await notificar(
            sessao, aluno_id, "inscricao.recusada",
            "Inscrição não aprovada",
            f"Sua inscrição em “{titulo_atividade}” não foi aprovada desta vez. "
            "Há outras atividades esperando por você.",
            "/atividades")


async def atividade_cancelada(sessao: AsyncSession, aluno_id: uuid.UUID,
                              titulo_atividade: str) -> None:
    await notificar(
        sessao, aluno_id, "atividade.cancelada",
        "Atividade cancelada",
        f"A organização cancelou “{titulo_atividade}”. Sua inscrição foi "
        "encerrada e não conta no seu limite de inscrições.",
        "/minhas-inscricoes")


async def certificado_emitido(sessao: AsyncSession, aluno_id: uuid.UUID,
                              titulo_atividade: str, horas: int) -> None:
    await notificar(
        sessao, aluno_id, "certificado.emitido",
        "Certificado disponível",
        f"Sua presença em “{titulo_atividade}” foi confirmada. O certificado de "
        f"{horas} {'hora' if horas == 1 else 'horas'} já pode ser baixado.",
        "/meus-certificados")


async def certificado_revogado(sessao: AsyncSession, aluno_id: uuid.UUID,
                               titulo_atividade: str, motivo: str) -> None:
    # O motivo aparece: ele já é público na verificação (RN-34), e o aluno
    # precisa saber por que o documento que entregou deixou de valer.
    await notificar(
        sessao, aluno_id, "certificado.revogado",
        "Certificado revogado",
        f"O certificado de “{titulo_atividade}” foi invalidado. Motivo: {motivo}",
        "/meus-certificados")


async def certificado_restabelecido(sessao: AsyncSession, aluno_id: uuid.UUID,
                                    titulo_atividade: str) -> None:
    await notificar(
        sessao, aluno_id, "certificado.restabelecido",
        "Certificado restabelecido",
        f"A revogação do certificado de “{titulo_atividade}” foi desfeita. Ele "
        "voltou a valer.",
        "/meus-certificados")


# ===================== Leitura =====================


def serializar(notificacao: Notificacao) -> dict:
    return {
        "id": str(notificacao.id),
        "tipo": notificacao.tipo,
        "titulo": notificacao.titulo,
        "mensagem": notificacao.mensagem,
        "link": notificacao.link,
        "lida": notificacao.lida_em is not None,
        "criadoEm": notificacao.criado_em.isoformat(),
    }


async def contar_nao_lidas(sessao: AsyncSession, usuario: Usuario) -> int:
    total = await sessao.scalar(
        select(func.count()).select_from(Notificacao)
        .where(Notificacao.destinatario_id == usuario.id,
               Notificacao.lida_em.is_(None)))
    return int(total or 0)


async def listar(sessao: AsyncSession, usuario: Usuario, *,
                 apenas_nao_lidas: bool = False, pagina: int = 1,
                 tamanho: int = 20) -> tuple[list[dict], int]:
    condicoes = [Notificacao.destinatario_id == usuario.id]
    if apenas_nao_lidas:
        condicoes.append(Notificacao.lida_em.is_(None))

    total = int(await sessao.scalar(
        select(func.count()).select_from(Notificacao).where(*condicoes)) or 0)

    resultado = await sessao.scalars(
        select(Notificacao).where(*condicoes)
        .order_by(Notificacao.criado_em.desc(), Notificacao.id.desc())
        .offset((pagina - 1) * tamanho).limit(tamanho))
    return [serializar(n) for n in resultado], total


async def marcar_lida(sessao: AsyncSession, usuario: Usuario,
                      notificacao_id: uuid.UUID) -> dict:
    notificacao = await sessao.get(Notificacao, notificacao_id)
    if notificacao is None or notificacao.destinatario_id != usuario.id:
        # 404 também para aviso alheio: não confirmar que o id existe.
        raise ErroDeNegocio("nao_encontrado", "Notificação não encontrada",
                            status.HTTP_404_NOT_FOUND)
    if notificacao.lida_em is None:
        notificacao.lida_em = agora()
        await sessao.commit()
    return serializar(notificacao)


async def marcar_todas(sessao: AsyncSession, usuario: Usuario) -> int:
    resultado = await sessao.execute(
        update(Notificacao)
        .where(Notificacao.destinatario_id == usuario.id,
               Notificacao.lida_em.is_(None))
        .values(lida_em=agora()))
    await sessao.commit()
    return resultado.rowcount or 0
