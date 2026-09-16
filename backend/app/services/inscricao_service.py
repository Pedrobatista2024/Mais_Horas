"""
Regras de inscrição.

Uma inscrição nasce `pendente` ou `confirmada` conforme a atividade exija ou não
aprovação (D1), e ocupa vaga nos dois casos (RN-19): sem isso, um aluno aprovado
poderia descobrir que já não há lugar — pior do que esperar pela resposta.

`recusada` e `cancelada` devolvem a vaga. `presente` e `ausente` continuam
ocupando, porque a pessoa de fato esteve (ou faltou) naquela vaga.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import Request, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import auditoria
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import Atividade, Inscricao, PerfilEstudante, PerfilOng, Usuario
from app.services import atividade_service, notificacao_service
from app.services.atividade_service import (
    SITUACOES_QUE_OCUPAM, agora, contar_ocupadas, hoje, situacao_real,
)

# Inscrição que ainda pode virar presença. É o que conta para o teto da RN-46 e
# o que o cancelamento da atividade derruba.
SITUACOES_ATIVAS = ("pendente", "confirmada")

LIMITE_DE_INSCRICOES_ATIVAS = config.inscricoes_ativas_max

# Campos do perfil exigidos antes da primeira inscrição (RN-45). Vive aqui e em
# perfil_service pela mesma razão: é a mesma regra vista dos dois lados.
CAMPOS_OBRIGATORIOS = ("nome_completo", "instituicao", "curso")

GRUPOS = ("proximas", "aguardando", "historico")


def _texto(momento: datetime | None) -> str | None:
    return momento.isoformat() if momento else None


def _ja_comecou(atividade: Atividade, momento: datetime | None = None) -> bool:
    """RN-20 — o aluno cancela até o início; depois, não."""
    momento = momento or agora()
    inicio = datetime.combine(atividade.data, atividade.hora_inicio,
                              tzinfo=atividade_service.TZ)
    return momento >= inicio


def _condicao_atividade_por_vir():
    """A atividade ainda não terminou — usada pelo teto e pelo grupo 'próximas'."""
    dia, hora = hoje(), agora().time()
    return or_(Atividade.data > dia,
               and_(Atividade.data == dia, Atividade.hora_fim >= hora))


# ===================== Serialização =====================


def _serializar_atividade(atividade: Atividade, nome_ong: str) -> dict:
    return {
        "id": str(atividade.id),
        "titulo": atividade.titulo,
        "data": atividade.data,
        "horaInicio": atividade.hora_inicio.strftime("%H:%M"),
        "horaFim": atividade.hora_fim.strftime("%H:%M"),
        "local": atividade.local,
        "cidade": atividade.cidade,
        "cargaHoraria": atividade.carga_horaria,
        "situacao": situacao_real(atividade),
        "ong": nome_ong,
    }


def _serializar_aluno(usuario: Usuario, perfil: PerfilEstudante | None) -> dict:
    return {
        "id": str(usuario.id),
        "nome": (perfil.nome_completo if perfil else None) or usuario.nome,
        "email": usuario.email,
        "curso": perfil.curso if perfil else None,
        "instituicao": perfil.instituicao if perfil else None,
        "foto": perfil.foto if perfil else None,
    }


def serializar(inscricao: Inscricao, *, atividade: dict | None = None,
               aluno: dict | None = None, pode_cancelar: bool = False) -> dict:
    return {
        "id": str(inscricao.id),
        "situacao": inscricao.situacao,
        "criadoEm": _texto(inscricao.criado_em),
        "respondidaEm": _texto(inscricao.respondida_em),
        "canceladaEm": _texto(inscricao.cancelada_em),
        "podeCancelar": pode_cancelar,
        "atividade": atividade,
        "aluno": aluno,
    }


# ===================== Busca e propriedade =====================


async def _buscar(sessao: AsyncSession, inscricao_id: uuid.UUID) -> Inscricao:
    inscricao = await sessao.scalar(
        select(Inscricao).where(Inscricao.id == inscricao_id)
        .options(selectinload(Inscricao.atividade))
    )
    if inscricao is None:
        raise ErroDeNegocio("nao_encontrado", "Inscrição não encontrada",
                            status.HTTP_404_NOT_FOUND)
    return inscricao


async def _buscar_do_aluno(sessao: AsyncSession, inscricao_id: uuid.UUID,
                           aluno: Usuario) -> Inscricao:
    inscricao = await _buscar(sessao, inscricao_id)
    if inscricao.usuario_id != aluno.id:
        # 404, não 403: o aluno não deve nem confirmar que a inscrição existe.
        raise ErroDeNegocio("nao_encontrado", "Inscrição não encontrada",
                            status.HTTP_404_NOT_FOUND)
    return inscricao


async def _buscar_da_ong(sessao: AsyncSession, inscricao_id: uuid.UUID,
                         ong: Usuario) -> Inscricao:
    """
    RN-11 — a decisão é de quem criou a atividade.

    A checagem é aqui, no serviço, e não só no papel da rota: foi exatamente a
    falta dela que deixou uma ONG marcar presença em atividade alheia (falha L2
    de docs/requisitos.md).
    """
    inscricao = await _buscar(sessao, inscricao_id)
    if inscricao.atividade.ong_id != ong.id:
        raise ErroDeNegocio("nao_e_dono",
                            "Esta inscrição é de uma atividade de outra organização",
                            status.HTTP_403_FORBIDDEN)
    return inscricao


async def _nome_da_ong(sessao: AsyncSession, ong_id: uuid.UUID) -> str:
    perfil = await sessao.get(PerfilOng, ong_id)
    if perfil and perfil.nome_organizacao:
        return perfil.nome_organizacao
    usuario = await sessao.get(Usuario, ong_id)
    return usuario.nome if usuario else ""


# ===================== Inscrever =====================


async def _conferir_perfil(sessao: AsyncSession, aluno: Usuario) -> None:
    """RN-45 — sem nome completo, instituição e curso, o certificado sairia torto."""
    perfil = await sessao.get(PerfilEstudante, aluno.id)
    faltantes = [c for c in CAMPOS_OBRIGATORIOS
                 if not (getattr(perfil, c, None) or "").strip()] if perfil \
        else list(CAMPOS_OBRIGATORIOS)

    if faltantes:
        raise ErroDeNegocio(
            "perfil_incompleto",
            "Complete seu perfil para se inscrever",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detalhes=[{"campo": c, "mensagem": "Obrigatório para se inscrever"}
                      for c in faltantes],
        )


async def contar_ativas(sessao: AsyncSession, aluno_id: uuid.UUID) -> int:
    """Inscrições que ainda vão acontecer — a base do teto da RN-46."""
    total = await sessao.scalar(
        select(func.count()).select_from(Inscricao)
        .join(Atividade, Atividade.id == Inscricao.atividade_id)
        .where(Inscricao.usuario_id == aluno_id,
               Inscricao.situacao.in_(SITUACOES_ATIVAS),
               _condicao_atividade_por_vir())
    )
    return int(total or 0)


async def criar(sessao: AsyncSession, aluno: Usuario, atividade_id: uuid.UUID,
                *, request: Request | None = None) -> dict:
    await _conferir_perfil(sessao, aluno)

    # `with_for_update` segura a linha da atividade até o fim da transação. Sem
    # isso, duas inscrições simultâneas na última vaga contariam o mesmo "resta
    # 1" e as duas entrariam — a restrição de unicidade não pega esse caso,
    # porque são alunos diferentes.
    atividade = await sessao.scalar(
        select(Atividade).where(Atividade.id == atividade_id).with_for_update()
    )
    if atividade is None:
        raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                            status.HTTP_404_NOT_FOUND)

    if atividade.situacao == "cancelada":
        raise ErroDeNegocio("atividade_cancelada", "Esta atividade foi cancelada")
    if situacao_real(atividade) != "publicada":
        # Rascunho, em andamento, a validar ou finalizada: todos fora da janela.
        raise ErroDeNegocio("inscricoes_encerradas", "As inscrições estão encerradas")

    existente = await sessao.scalar(
        select(Inscricao).where(Inscricao.atividade_id == atividade_id,
                               Inscricao.usuario_id == aluno.id)
    )
    if existente is not None and existente.situacao in SITUACOES_QUE_OCUPAM:
        raise ErroDeNegocio("ja_inscrito", "Você já está inscrito nesta atividade",
                            status.HTTP_409_CONFLICT)

    if await contar_ocupadas(sessao, atividade_id) >= atividade.vagas_max:
        raise ErroDeNegocio("vagas_esgotadas", "As vagas se esgotaram")

    ativas = await contar_ativas(sessao, aluno.id)
    if ativas >= LIMITE_DE_INSCRICOES_ATIVAS:
        raise ErroDeNegocio(
            "limite_de_inscricoes",
            f"Você já tem {LIMITE_DE_INSCRICOES_ATIVAS} inscrições ativas. "
            "Conclua ou cancele alguma",
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    nova_situacao = "pendente" if atividade.exige_aprovacao else "confirmada"

    if existente is not None:
        # Quem cancelou ou foi recusado pode tentar de novo (FE-04 A3). A linha
        # é reaproveitada porque o par (atividade, aluno) é único no banco.
        existente.situacao = nova_situacao
        existente.cancelada_em = None
        existente.respondida_em = None
        existente.respondida_por = None
        inscricao = existente
    else:
        inscricao = Inscricao(atividade_id=atividade_id, usuario_id=aluno.id,
                              situacao=nova_situacao)
        sessao.add(inscricao)

    await sessao.flush()

    await auditoria.registrar(
        sessao, "inscricao.criada", ator_id=aluno.id, ator_papel=aluno.papel,
        entidade="inscricao", entidade_id=inscricao.id,
        depois={"situacao": nova_situacao, "atividade_id": str(atividade_id)},
        request=request,
    )
    await sessao.commit()

    nome_ong = await _nome_da_ong(sessao, atividade.ong_id)
    return serializar(inscricao,
                      atividade=_serializar_atividade(atividade, nome_ong),
                      pode_cancelar=not _ja_comecou(atividade))


# ===================== Cancelar =====================


async def cancelar(sessao: AsyncSession, aluno: Usuario, inscricao_id: uuid.UUID,
                   *, request: Request | None = None) -> dict:
    inscricao = await _buscar_do_aluno(sessao, inscricao_id, aluno)

    if inscricao.situacao not in SITUACOES_ATIVAS:
        raise ErroDeNegocio(
            "situacao_invalida",
            "Esta inscrição não está ativa e não pode ser cancelada")

    if _ja_comecou(inscricao.atividade):
        raise ErroDeNegocio(
            "cancelamento_fora_do_prazo",
            "A atividade já começou e não pode mais ser cancelada")

    anterior = inscricao.situacao
    inscricao.situacao = "cancelada"
    inscricao.cancelada_em = agora()

    await auditoria.registrar(
        sessao, "inscricao.cancelada", ator_id=aluno.id, ator_papel=aluno.papel,
        entidade="inscricao", entidade_id=inscricao.id,
        antes={"situacao": anterior}, depois={"situacao": "cancelada"},
        request=request,
    )
    await sessao.commit()

    nome_ong = await _nome_da_ong(sessao, inscricao.atividade.ong_id)
    return serializar(inscricao,
                      atividade=_serializar_atividade(inscricao.atividade, nome_ong))


# ===================== Aprovar e recusar =====================


async def _responder(sessao: AsyncSession, ong: Usuario, inscricao: Inscricao,
                     aprovar: bool, *, request: Request | None = None) -> Inscricao:
    if inscricao.situacao != "pendente":
        raise ErroDeNegocio("situacao_invalida", "Esta inscrição já foi respondida")
    if _ja_comecou(inscricao.atividade):
        raise ErroDeNegocio("atividade_ja_comecou", "A atividade já começou")

    inscricao.situacao = "confirmada" if aprovar else "recusada"
    inscricao.respondida_em = agora()
    inscricao.respondida_por = ong.id

    await auditoria.registrar(
        sessao, "inscricao.aprovada" if aprovar else "inscricao.recusada",
        ator_id=ong.id, ator_papel=ong.papel,
        entidade="inscricao", entidade_id=inscricao.id,
        antes={"situacao": "pendente"}, depois={"situacao": inscricao.situacao},
        request=request,
    )
    await notificacao_service.inscricao_respondida(
        sessao, inscricao.usuario_id, inscricao.atividade.titulo, aprovar)
    return inscricao


async def responder(sessao: AsyncSession, ong: Usuario, inscricao_id: uuid.UUID,
                    aprovar: bool, *, request: Request | None = None) -> dict:
    inscricao = await _buscar_da_ong(sessao, inscricao_id, ong)
    await _responder(sessao, ong, inscricao, aprovar, request=request)
    await sessao.commit()

    usuario = await sessao.get(Usuario, inscricao.usuario_id)
    perfil = await sessao.get(PerfilEstudante, inscricao.usuario_id)
    return serializar(inscricao, aluno=_serializar_aluno(usuario, perfil))


async def aprovar_em_lote(sessao: AsyncSession, ong: Usuario,
                          ids: list[uuid.UUID], *,
                          request: Request | None = None) -> dict:
    """
    Aprova o que der e conta o resto.

    Uma inscrição cancelada no meio do caminho não pode derrubar as outras
    aprovações — mas sumir em silêncio seria pior: a ONG acharia que aprovou
    alguém que continua de fora.
    """
    aprovadas, ignoradas = 0, []

    for inscricao_id in ids:
        try:
            inscricao = await _buscar_da_ong(sessao, inscricao_id, ong)
            await _responder(sessao, ong, inscricao, True, request=request)
            aprovadas += 1
        except ErroDeNegocio as erro:
            ignoradas.append({"id": str(inscricao_id), "motivo": erro.mensagem})

    await sessao.commit()
    return {"aprovadas": aprovadas, "ignoradas": ignoradas}


# ===================== Listagens =====================


def _condicao_de_grupo(grupo: str) -> list:
    """
    Os três grupos de `E4`, traduzidos em SQL.

    Separar no navegador daria total e paginação errados, pelo mesmo motivo das
    abas de `O2`: a página traz um punhado misturado.
    """
    if grupo == "aguardando":
        return [Inscricao.situacao == "pendente"]

    if grupo == "proximas":
        return [Inscricao.situacao == "confirmada", _condicao_atividade_por_vir()]

    if grupo == "historico":
        # Tudo que já foi resolvido, mais a confirmada cuja atividade passou sem
        # a ONG ter validado a presença.
        return [or_(Inscricao.situacao.in_(("recusada", "cancelada",
                                            "presente", "ausente")),
                    and_(Inscricao.situacao == "confirmada",
                         ~_condicao_atividade_por_vir()))]
    return []


async def listar_minhas(sessao: AsyncSession, aluno: Usuario, *,
                        grupo: str | None = None, pagina: int = 1,
                        tamanho: int = 20) -> tuple[list[dict], int]:
    condicoes = [Inscricao.usuario_id == aluno.id]
    if grupo in GRUPOS:
        condicoes += _condicao_de_grupo(grupo)

    total = int(await sessao.scalar(
        select(func.count()).select_from(Inscricao)
        .join(Atividade, Atividade.id == Inscricao.atividade_id)
        .where(*condicoes)
    ) or 0)

    resultado = await sessao.scalars(
        select(Inscricao)
        .join(Atividade, Atividade.id == Inscricao.atividade_id)
        .where(*condicoes)
        .options(selectinload(Inscricao.atividade))
        .order_by(Atividade.data.asc(), Atividade.hora_inicio.asc())
        .offset((pagina - 1) * tamanho).limit(tamanho)
    )

    itens = []
    for inscricao in resultado:
        atividade = inscricao.atividade
        nome_ong = await _nome_da_ong(sessao, atividade.ong_id)
        itens.append(serializar(
            inscricao,
            atividade=_serializar_atividade(atividade, nome_ong),
            pode_cancelar=(inscricao.situacao in SITUACOES_ATIVAS
                           and not _ja_comecou(atividade)),
        ))
    return itens, total


async def listar_da_atividade(sessao: AsyncSession, ong: Usuario,
                              atividade_id: uuid.UUID, *,
                              situacao: str | None = None, pagina: int = 1,
                              tamanho: int = 50) -> tuple[list[dict], int]:
    """Lista de `O5`. Só a ONG dona chega aqui — é ela quem vê os nomes (RN-47)."""
    atividade = await sessao.get(Atividade, atividade_id)
    if atividade is None:
        raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                            status.HTTP_404_NOT_FOUND)
    if atividade.ong_id != ong.id:
        raise ErroDeNegocio("nao_e_dono", "Esta atividade é de outra organização",
                            status.HTTP_403_FORBIDDEN)

    condicoes = [Inscricao.atividade_id == atividade_id]
    if situacao in ("pendente", "confirmada", "recusada", "cancelada",
                    "presente", "ausente"):
        condicoes.append(Inscricao.situacao == situacao)

    total = int(await sessao.scalar(
        select(func.count()).select_from(Inscricao).where(*condicoes)
    ) or 0)

    resultado = await sessao.scalars(
        select(Inscricao).where(*condicoes)
        .options(selectinload(Inscricao.usuario))
        .order_by(Inscricao.criado_em.asc())
        .offset((pagina - 1) * tamanho).limit(tamanho)
    )

    itens = []
    for inscricao in resultado:
        perfil = await sessao.get(PerfilEstudante, inscricao.usuario_id)
        itens.append(serializar(
            inscricao, aluno=_serializar_aluno(inscricao.usuario, perfil)))
    return itens, total
