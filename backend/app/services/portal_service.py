"""
Dados do portal público (T1 a T5) — tudo sem login.

Os números saem do banco ou não aparecem: contagem fixa no código vira
constrangimento na hora que alguém pergunta de onde veio.
"""

from __future__ import annotations

import uuid

from fastapi import status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import Atividade, Certificado, PerfilOng, Usuario
from app.services import atividade_service

# O que conta como "a ONG já fez algo aqui": rascunho e cancelada não contam.
SITUACOES_QUE_APARECEM = ("publicada", "finalizada")


def _ong_ativa() -> tuple:
    return (Usuario.papel == "ong", Usuario.situacao == "ativa")


async def resumo(sessao: AsyncSession) -> dict:
    """Números de impacto de T1. Certificado revogado não conta."""
    certificados, horas = (await sessao.execute(
        select(func.count(Certificado.id),
               func.coalesce(func.sum(Certificado.horas), 0))
        .where(Certificado.revogado_em.is_(None))
    )).one()
    realizadas = await sessao.scalar(
        select(func.count()).select_from(Atividade)
        .where(Atividade.situacao == "finalizada"))
    estudantes = await sessao.scalar(
        select(func.count()).select_from(Usuario)
        .where(Usuario.papel == "estudante", Usuario.situacao == "ativa"))
    ongs = await sessao.scalar(
        select(func.count()).select_from(Usuario).where(*_ong_ativa()))
    # A mesma regra da vitrine, para o número bater com o que a pessoa vai ver.
    _, abertas = await atividade_service.listar_vitrine(sessao, tamanho=1)

    return {
        "atividadesRealizadas": int(realizadas or 0),
        "atividadesAbertas": abertas,
        "horasCertificadas": int(horas or 0),
        "certificadosEmitidos": int(certificados or 0),
        "estudantes": int(estudantes or 0),
        "ongs": int(ongs or 0),
        "codigoDemonstracao": await _codigo_demonstracao(sessao),
    }


async def _codigo_demonstracao(sessao: AsyncSession) -> str | None:
    """Só devolve o código se ele existir e for válido: botão quebrado, não."""
    codigo = config.certificado_demonstracao.strip()
    if not codigo:
        return None
    existe = await sessao.scalar(
        select(Certificado.id).where(Certificado.codigo_verificacao == codigo,
                                     Certificado.revogado_em.is_(None)))
    return codigo if existe else None


def _realizadas():
    return func.count(case((Atividade.situacao == "finalizada", 1)))


def _abertas():
    return func.count(case((
        (Atividade.situacao == "publicada")
        & (Atividade.data >= atividade_service.hoje()), 1)))


def _serializar_ong(usuario: Usuario, perfil: PerfilOng | None,
                    realizadas: int, abertas: int) -> dict:
    return {
        "id": str(usuario.id),
        "nome": (perfil.nome_organizacao if perfil else None) or usuario.nome,
        "descricao": perfil.descricao if perfil else None,
        "cidade": perfil.cidade if perfil else None,
        "estado": perfil.estado if perfil else None,
        "logo": perfil.logo if perfil else None,
        "verificada": bool(perfil and perfil.verificada_em),
        "atividadesRealizadas": int(realizadas or 0),
        "atividadesAbertas": int(abertas or 0),
    }


async def listar_ongs(
    sessao: AsyncSession, *, busca: str | None = None,
    pagina: int = 1, tamanho: int = 12,
) -> tuple[list[dict], int]:
    """
    T5 — organizações ativas que já publicaram algo.

    Conta nova, sem nenhuma atividade, fica de fora: vitrine de parceiras com
    cartão vazio não prova nada. Verificadas primeiro, depois quem mais fez.
    """
    realizadas = _realizadas().label("realizadas")
    abertas = _abertas().label("abertas")

    consulta = (
        select(Usuario, PerfilOng, realizadas, abertas)
        .join(Atividade, Atividade.ong_id == Usuario.id)
        .outerjoin(PerfilOng, PerfilOng.usuario_id == Usuario.id)
        .where(*_ong_ativa(), Atividade.situacao.in_(SITUACOES_QUE_APARECEM))
        .group_by(Usuario.id, PerfilOng.usuario_id)
    )
    if busca and busca.strip():
        alvo = f"%{busca.strip()}%"
        consulta = consulta.where(or_(Usuario.nome.ilike(alvo),
                                      PerfilOng.nome_organizacao.ilike(alvo),
                                      PerfilOng.cidade.ilike(alvo)))

    total = int(await sessao.scalar(
        select(func.count()).select_from(consulta.subquery())) or 0)

    nome = func.lower(func.coalesce(PerfilOng.nome_organizacao, Usuario.nome))
    linhas = await sessao.execute(
        consulta.order_by(PerfilOng.verificada_em.is_(None), realizadas.desc(), nome)
        .offset((pagina - 1) * tamanho).limit(tamanho)
    )
    itens = [_serializar_ong(u, p, r, a) for u, p, r, a in linhas]
    return itens, total


async def detalhar_ong(sessao: AsyncSession, ong_id: uuid.UUID) -> dict:
    """
    Perfil público da ONG, com as próximas atividades.

    Telefone, CNPJ e endereço ficam de fora: muita ONG pequena funciona na casa
    de alguém, e a página é aberta a qualquer visitante.
    """
    usuario = await sessao.get(Usuario, ong_id)
    if usuario is None or usuario.papel != "ong" or usuario.situacao != "ativa":
        raise ErroDeNegocio("nao_encontrado", "Organização não encontrada",
                            status.HTTP_404_NOT_FOUND)

    perfil = await sessao.get(PerfilOng, ong_id)
    realizadas, abertas = (await sessao.execute(
        select(_realizadas(), _abertas()).where(Atividade.ong_id == ong_id)
    )).one()
    horas = await sessao.scalar(
        select(func.coalesce(func.sum(Certificado.horas), 0))
        .join(Atividade, Atividade.id == Certificado.atividade_id)
        .where(Atividade.ong_id == ong_id, Certificado.revogado_em.is_(None)))
    proximas, _ = await atividade_service.listar_vitrine(
        sessao, ong_id=ong_id, tamanho=6)

    corpo = _serializar_ong(usuario, perfil, realizadas, abertas)
    corpo.update({
        "site": perfil.site if perfil else None,
        "instagram": perfil.instagram if perfil else None,
        "horasCertificadas": int(horas or 0),
        "desde": usuario.criado_em.date().isoformat(),
        "proximasAtividades": proximas,
    })
    return corpo
