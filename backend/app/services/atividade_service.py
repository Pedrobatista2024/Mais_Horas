"""
Regras de atividade.

Ciclo de vida: rascunho → publicada → (em andamento → aguardando validação) →
finalizada, com cancelamento possível a partir de publicada.

Os dois estados entre parênteses **não existem no banco** (D22, RN-54): saem da
comparação entre o horário da atividade e o relógio. Isso elimina a necessidade
de processo em segundo plano, que falharia em silêncio se caísse e não roda de
forma confiável em serviço que hiberna por inatividade.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import Request, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import auditoria
from app.core.config import FUSO
from app.core.errors import ErroDeNegocio
from app.db.models import Atividade, Inscricao, PerfilOng, Usuario
from app.services import notificacao_service

TZ = ZoneInfo(FUSO)

# Inscrições que ocupam vaga (RN-19). Recusada e cancelada devolvem.
SITUACOES_QUE_OCUPAM = ("pendente", "confirmada", "presente", "ausente")

CAMPOS_EDITAVEIS = (
    "titulo", "descricao", "local", "cidade", "estado", "data",
    "hora_inicio", "hora_fim", "carga_horaria", "vagas_min", "vagas_max",
    "exige_aprovacao",
)

# Com inscritos, só os limites de vaga podem mudar (RN-12): alterar data, local
# ou carga mudaria as condições sob as quais as pessoas se inscreveram.
CAMPOS_COM_INSCRITOS = ("vagas_min", "vagas_max")


def agora() -> datetime:
    return datetime.now(TZ)


def hoje() -> date:
    return agora().date()


def situacao_real(atividade: Atividade, momento: datetime | None = None) -> str:
    """Situação efetiva, derivada do relógio (RN-54)."""
    if atividade.situacao != "publicada":
        return atividade.situacao

    momento = momento or agora()
    inicio = datetime.combine(atividade.data, atividade.hora_inicio, tzinfo=TZ)
    fim = datetime.combine(atividade.data, atividade.hora_fim, tzinfo=TZ)

    if momento < inicio:
        return "publicada"
    if momento > fim:
        return "aguardando_validacao"
    return "em_andamento"


async def contar_ocupadas(sessao: AsyncSession, atividade_id: uuid.UUID) -> int:
    total = await sessao.scalar(
        select(func.count()).select_from(Inscricao).where(
            Inscricao.atividade_id == atividade_id,
            Inscricao.situacao.in_(SITUACOES_QUE_OCUPAM),
        )
    )
    return int(total or 0)


async def serializar(
    sessao: AsyncSession, atividade: Atividade, *,
    usuario: Usuario | None = None, ocupadas: int | None = None,
) -> dict:
    if ocupadas is None:
        ocupadas = await contar_ocupadas(sessao, atividade.id)

    ong = atividade.ong
    perfil = await sessao.get(PerfilOng, atividade.ong_id)
    nome_ong = (perfil.nome_organizacao if perfil else None) or (ong.nome if ong else "")

    corpo = {
        "id": str(atividade.id),
        "titulo": atividade.titulo,
        "descricao": atividade.descricao,
        "local": atividade.local,
        "cidade": atividade.cidade,
        "estado": atividade.estado,
        "data": atividade.data,
        "horaInicio": atividade.hora_inicio.strftime("%H:%M"),
        "horaFim": atividade.hora_fim.strftime("%H:%M"),
        "cargaHoraria": atividade.carga_horaria,
        "vagasMin": atividade.vagas_min,
        "vagasMax": atividade.vagas_max,
        "vagasOcupadas": ocupadas,
        "vagasRestantes": max(0, atividade.vagas_max - ocupadas),
        "lotada": ocupadas >= atividade.vagas_max,
        "exigeAprovacao": atividade.exige_aprovacao,
        "situacao": situacao_real(atividade),
        "ong": {
            "id": str(atividade.ong_id),
            "nome": nome_ong,
            "verificada": bool(perfil and perfil.verificada_em),
        },
        "editadaPorAdminEm": (atividade.editada_por_admin_em.isoformat()
                              if atividade.editada_por_admin_em else None),
        "minhaInscricao": None,
    }

    if usuario is not None and usuario.papel == "estudante":
        inscricao = await sessao.scalar(
            select(Inscricao).where(Inscricao.atividade_id == atividade.id,
                                    Inscricao.usuario_id == usuario.id)
        )
        if inscricao is not None:
            corpo["minhaInscricao"] = {
                "id": str(inscricao.id), "situacao": inscricao.situacao,
            }

    return corpo


async def _buscar(sessao: AsyncSession, atividade_id: uuid.UUID) -> Atividade:
    atividade = await sessao.scalar(
        select(Atividade).where(Atividade.id == atividade_id)
        .options(selectinload(Atividade.ong))
    )
    if atividade is None:
        raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                            status.HTTP_404_NOT_FOUND)
    return atividade


async def _buscar_da_ong(
    sessao: AsyncSession, atividade_id: uuid.UUID, ong: Usuario
) -> Atividade:
    """RN-11 — só a criadora mexe na atividade."""
    atividade = await _buscar(sessao, atividade_id)
    if atividade.ong_id != ong.id:
        raise ErroDeNegocio("nao_e_dono", "Esta atividade é de outra organização",
                            status.HTTP_403_FORBIDDEN)
    return atividade


# ===================== Vitrine =====================


async def listar_vitrine(
    sessao: AsyncSession, *, usuario: Usuario | None = None,
    pagina: int = 1, tamanho: int = 20, busca: str | None = None,
    cidade: str | None = None, carga_min: int | None = None,
    carga_max: int | None = None, com_vaga: bool = False,
    ong_id: uuid.UUID | None = None,
) -> tuple[list[dict], int]:
    """
    Filtrada **no servidor** (não no navegador, como na versão anterior).

    Mostra só `publicada` com data de hoje em diante. Atividade lotada continua
    aparecendo (D7) — ela some da vitrine quando o dia passa, não quando enche.
    """
    condicoes = [
        Atividade.situacao == "publicada", Atividade.data >= hoje(),
        # RN-36 — atividade de ONG suspensa sai da vitrine, mesmo a que já
        # começou e por isso não foi cancelada na suspensão.
        Atividade.ong_id.in_(select(Usuario.id).where(Usuario.situacao == "ativa")),
    ]

    if busca:
        alvo = f"%{busca.strip()}%"
        condicoes.append(or_(Atividade.titulo.ilike(alvo),
                             Atividade.local.ilike(alvo),
                             Atividade.cidade.ilike(alvo)))
    if cidade:
        condicoes.append(Atividade.cidade.ilike(f"%{cidade.strip()}%"))
    if ong_id is not None:
        condicoes.append(Atividade.ong_id == ong_id)
    if com_vaga:
        # No SQL, e não depois da consulta: filtrar a página já montada deixava
        # o total e a paginação errados sempre que havia atividade lotada.
        ocupadas = (
            select(func.count()).select_from(Inscricao)
            .where(Inscricao.atividade_id == Atividade.id,
                   Inscricao.situacao.in_(SITUACOES_QUE_OCUPAM))
            .correlate(Atividade).scalar_subquery()
        )
        condicoes.append(ocupadas < Atividade.vagas_max)
    if carga_min is not None:
        condicoes.append(Atividade.carga_horaria >= carga_min)
    if carga_max is not None:
        condicoes.append(Atividade.carga_horaria <= carga_max)

    total = int(await sessao.scalar(
        select(func.count()).select_from(Atividade).where(*condicoes)
    ) or 0)

    resultado = await sessao.scalars(
        select(Atividade).where(*condicoes)
        .options(selectinload(Atividade.ong))
        .order_by(Atividade.data.asc(), Atividade.hora_inicio.asc())
        .offset((pagina - 1) * tamanho).limit(tamanho)
    )

    itens = [await serializar(sessao, atividade, usuario=usuario)
             for atividade in resultado]
    return itens, total


# Situações que a ONG pode pedir nas abas de O2, incluindo as derivadas.
SITUACOES_FILTRAVEIS = (
    "rascunho", "publicada", "em_andamento", "aguardando_validacao",
    "finalizada", "cancelada",
)


def _condicao_de_situacao(situacao: str) -> list:
    """
    Traduz a situação pedida em condição SQL.

    As três derivadas partem todas de `publicada` gravada e se separam pelo
    relógio (RN-54). A comparação usa data e hora calculadas aqui, no fuso do
    Brasil, em vez do `now()` do banco: assim o resultado não depende do fuso
    em que o Postgres foi configurado.
    """
    if situacao not in SITUACOES_FILTRAVEIS:
        return []

    if situacao in ("rascunho", "finalizada", "cancelada"):
        return [Atividade.situacao == situacao]

    dia, hora = hoje(), agora().time()
    publicada = Atividade.situacao == "publicada"

    if situacao == "publicada":  # ainda não começou
        return [publicada, or_(Atividade.data > dia,
                               and_(Atividade.data == dia, Atividade.hora_inicio > hora))]

    if situacao == "em_andamento":
        return [publicada, Atividade.data == dia,
                Atividade.hora_inicio <= hora, Atividade.hora_fim >= hora]

    # aguardando_validacao — já terminou e ninguém validou
    return [publicada, or_(Atividade.data < dia,
                           and_(Atividade.data == dia, Atividade.hora_fim < hora))]


async def listar_da_ong(
    sessao: AsyncSession, ong: Usuario, *, situacao: str | None = None,
    pagina: int = 1, tamanho: int = 20,
) -> tuple[list[dict], int]:
    condicoes = [Atividade.ong_id == ong.id]
    if situacao:
        condicoes += _condicao_de_situacao(situacao)

    total = int(await sessao.scalar(
        select(func.count()).select_from(Atividade).where(*condicoes)
    ) or 0)

    resultado = await sessao.scalars(
        select(Atividade).where(*condicoes)
        .options(selectinload(Atividade.ong))
        .order_by(Atividade.data.desc(), Atividade.criado_em.desc())
        .offset((pagina - 1) * tamanho).limit(tamanho)
    )
    itens = [await serializar(sessao, a, usuario=ong) for a in resultado]
    return itens, total


async def detalhar(
    sessao: AsyncSession, atividade_id: uuid.UUID, *, usuario: Usuario | None = None
) -> dict:
    atividade = await _buscar(sessao, atividade_id)

    # Rascunho é privado da ONG: não existe para mais ninguém.
    if atividade.situacao == "rascunho":
        if usuario is None or usuario.id != atividade.ong_id:
            raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                                status.HTTP_404_NOT_FOUND)

    return await serializar(sessao, atividade, usuario=usuario)


# ===================== Ciclo de vida =====================


def _validar_data(quando: date) -> None:
    """RN-05 — vale na criação e na edição."""
    if quando < hoje():
        raise ErroDeNegocio("data_no_passado", "A data não pode ser no passado")


async def criar(
    sessao: AsyncSession, ong: Usuario, dados: dict, *, request: Request | None = None
) -> dict:
    _validar_data(dados["data"])

    atividade = Atividade(ong_id=ong.id, situacao="rascunho",
                          **{c: dados[c] for c in CAMPOS_EDITAVEIS if c in dados})
    sessao.add(atividade)
    await sessao.flush()

    await auditoria.registrar(
        sessao, "atividade.rascunho_criado", ator_id=ong.id, ator_papel=ong.papel,
        entidade="atividade", entidade_id=atividade.id,
        depois={"titulo": atividade.titulo}, request=request,
    )
    await sessao.commit()
    await sessao.refresh(atividade, ["ong"])
    return await serializar(sessao, atividade, usuario=ong, ocupadas=0)


async def aplicar_edicao(
    sessao: AsyncSession, atividade: Atividade, ator: Usuario, dados: dict, *,
    travar_com_inscritos: bool, acao: str, request: Request | None = None,
) -> tuple[int, bool]:
    """
    Valida e aplica a edição. **Não dá commit.** Devolve (vagas ocupadas,
    se algum campo mudou).

    A ONG edita com a trava da RN-12; o admin, não — ele existe justamente
    para corrigir o que a ONG não corrige, e a correção fica visível (RN-35).
    As travas de coerência (vagas, horário, data) valem para os dois.
    """
    if atividade.situacao in ("finalizada", "cancelada"):
        raise ErroDeNegocio(
            "atividade_encerrada",
            f"Atividade {atividade.situacao} não pode ser editada",
            status.HTTP_403_FORBIDDEN,
        )

    ocupadas = await contar_ocupadas(sessao, atividade.id)

    # RN-12 — com gente inscrita, só as vagas mudam. Recusar é melhor que
    # ignorar em silêncio: o usuário precisa saber por que não pode.
    if travar_com_inscritos and ocupadas > 0:
        bloqueados = [c for c in dados if c not in CAMPOS_COM_INSCRITOS]
        if bloqueados:
            raise ErroDeNegocio(
                "edicao_bloqueada_com_inscritos",
                f"Já há {ocupadas} inscrito(s): só o número de vagas pode ser alterado",
                detalhes=[{"campo": c, "mensagem": "Bloqueado com inscritos"}
                          for c in bloqueados],
            )

    novo_max = dados.get("vagas_max", atividade.vagas_max)
    if novo_max < ocupadas:
        raise ErroDeNegocio(
            "vagas_abaixo_dos_inscritos",
            f"O máximo não pode ser menor que os {ocupadas} já inscritos",
        )

    novo_min = dados.get("vagas_min", atividade.vagas_min)
    if novo_max < novo_min:
        raise ErroDeNegocio("vagas_incoerentes",
                            "O máximo de vagas não pode ser menor que o mínimo")

    if "data" in dados:
        _validar_data(dados["data"])

    inicio = dados.get("hora_inicio", atividade.hora_inicio)
    fim = dados.get("hora_fim", atividade.hora_fim)
    if fim <= inicio:
        raise ErroDeNegocio("horario_invalido",
                            "O horário de término deve ser posterior ao de início")

    antes, depois = {}, {}
    for campo in CAMPOS_EDITAVEIS:
        if campo not in dados:
            continue
        atual, novo = getattr(atividade, campo), dados[campo]
        if atual != novo:
            antes[campo] = str(atual)
            depois[campo] = str(novo)
            setattr(atividade, campo, novo)

    if depois:
        await auditoria.registrar(
            sessao, acao, ator_id=ator.id, ator_papel=ator.papel,
            entidade="atividade", entidade_id=atividade.id,
            antes=antes, depois=depois, request=request,
        )
    return ocupadas, bool(depois)


async def editar(
    sessao: AsyncSession, ong: Usuario, atividade_id: uuid.UUID, dados: dict,
    *, request: Request | None = None,
) -> dict:
    atividade = await _buscar_da_ong(sessao, atividade_id, ong)
    ocupadas, _ = await aplicar_edicao(
        sessao, atividade, ong, dados, travar_com_inscritos=True,
        acao="atividade.editada", request=request)
    await sessao.commit()
    return await serializar(sessao, atividade, usuario=ong, ocupadas=ocupadas)


async def publicar(
    sessao: AsyncSession, ong: Usuario, atividade_id: uuid.UUID,
    *, request: Request | None = None,
) -> dict:
    atividade = await _buscar_da_ong(sessao, atividade_id, ong)

    if atividade.situacao != "rascunho":
        raise ErroDeNegocio("situacao_invalida",
                            "Só um rascunho pode ser publicado")
    _validar_data(atividade.data)

    atividade.situacao = "publicada"
    atividade.publicada_em = agora()

    await auditoria.registrar(
        sessao, "atividade.publicada", ator_id=ong.id, ator_papel=ong.papel,
        entidade="atividade", entidade_id=atividade.id,
        antes={"situacao": "rascunho"}, depois={"situacao": "publicada"},
        request=request,
    )
    await sessao.commit()
    return await serializar(sessao, atividade, usuario=ong)


async def encerrar_por_cancelamento(
    sessao: AsyncSession, atividade: Atividade, ator: Usuario,
    motivo: str | None, *, request: Request | None = None,
) -> None:
    """
    Cancela e derruba as inscrições ativas, avisando cada aluno. **Não dá
    commit** — a suspensão de uma ONG cancela várias atividades de uma vez, e
    ou todas caem, ou nenhuma.
    """
    if atividade.situacao in ("finalizada", "cancelada"):
        raise ErroDeNegocio(
            "situacao_invalida",
            f"Atividade {atividade.situacao} não pode ser cancelada")

    anterior = atividade.situacao
    atividade.situacao = "cancelada"
    atividade.cancelada_em = agora()
    atividade.cancelada_por = ator.id

    # As inscrições ativas caem junto — a vaga não faz sentido sem o evento.
    inscricoes = await sessao.scalars(
        select(Inscricao).where(Inscricao.atividade_id == atividade.id,
                                Inscricao.situacao.in_(("pendente", "confirmada")))
    )
    for inscricao in inscricoes:
        inscricao.situacao = "cancelada"
        inscricao.cancelada_em = agora()
        # Sem o motivo: ele é da trilha de auditoria, não do aluno (D10).
        await notificacao_service.atividade_cancelada(
            sessao, inscricao.usuario_id, atividade.titulo)

    await auditoria.registrar(
        sessao, "atividade.cancelada", ator_id=ator.id, ator_papel=ator.papel,
        entidade="atividade", entidade_id=atividade.id,
        antes={"situacao": anterior},
        depois={"situacao": "cancelada", "motivo": motivo}, request=request,
    )


async def cancelar(
    sessao: AsyncSession, ong: Usuario, atividade_id: uuid.UUID,
    motivo: str | None, *, request: Request | None = None,
) -> dict:
    atividade = await _buscar_da_ong(sessao, atividade_id, ong)
    await encerrar_por_cancelamento(sessao, atividade, ong, motivo, request=request)
    await sessao.commit()
    return await serializar(sessao, atividade, usuario=ong)


async def excluir(
    sessao: AsyncSession, ong: Usuario, atividade_id: uuid.UUID,
    *, request: Request | None = None,
) -> None:
    """
    RN-20 — só rascunho é apagado de verdade.

    Atividade publicada sai de cena mudando de situação. Apagar uma finalizada
    destruiria certificados já entregues a coordenações.
    """
    atividade = await _buscar_da_ong(sessao, atividade_id, ong)

    if atividade.situacao != "rascunho":
        raise ErroDeNegocio(
            "so_rascunho_pode_ser_excluido",
            "Só um rascunho pode ser excluído. Cancele a atividade em vez disso.",
            status.HTTP_403_FORBIDDEN,
        )

    await auditoria.registrar(
        sessao, "atividade.excluida", ator_id=ong.id, ator_papel=ong.papel,
        entidade="atividade", entidade_id=atividade.id,
        antes={"titulo": atividade.titulo}, request=request,
    )
    await sessao.delete(atividade)
    await sessao.commit()
