"""
Painéis de entrada do aluno (E1) e da ONG (O1).

Cada painel devolve dois blocos: os indicadores e **um** destaque — a ação mais
urgente do momento. O destaque é escolhido no servidor, e não no navegador,
porque a ordem de prioridade é regra de negócio: quem tem atividade acontecendo
agora precisa ver o check-in antes de qualquer outra coisa.

Nada aqui altera estado; é tudo leitura.
"""

from __future__ import annotations

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Atividade, Certificado, Inscricao, Notificacao, Usuario
from app.services import atividade_service, inscricao_service

# Situações de inscrição que contam como "essa pessoa participou ou vai
# participar" — é o que faz sentido chamar de voluntário engajado.
SITUACOES_ENGAJADAS = ("confirmada", "presente")


def _no_fuso(atividade: Atividade) -> dict:
    return {
        "id": str(atividade.id),
        "titulo": atividade.titulo,
        "data": atividade.data.isoformat(),
        "horaInicio": atividade.hora_inicio.strftime("%H:%M"),
        "horaFim": atividade.hora_fim.strftime("%H:%M"),
        "local": atividade.local,
    }


def _primeira(consulta: Select) -> Select:
    return consulta.order_by(Atividade.data.asc(), Atividade.hora_inicio.asc()).limit(1)


# ===================== E1 — aluno =====================


def _minhas_atividades(aluno: Usuario, *situacoes_da_inscricao: str) -> Select:
    return (
        select(Atividade)
        .join(Inscricao, Inscricao.atividade_id == Atividade.id)
        .where(Inscricao.usuario_id == aluno.id,
               Inscricao.situacao.in_(situacoes_da_inscricao))
    )


async def _destaque_do_aluno(sessao: AsyncSession, aluno: Usuario) -> dict:
    """
    A ordem é a da especificação (E1): check-in, evento de hoje, certificado
    novo, nada. A primeira situação que existir vence — não se acumulam.
    """
    acontecendo = await sessao.scalar(_primeira(
        _minhas_atividades(aluno, "confirmada")
        .where(*atividade_service.condicao_de_situacao("em_andamento"))
        .where(Inscricao.checkin_em.is_(None))
    ))
    if acontecendo is not None:
        return {"tipo": "checkin_disponivel",
                "titulo": f"{acontecendo.titulo} está acontecendo agora",
                "mensagem": "Faça o check-in pelo QR Code exibido pela organização.",
                "atividade": _no_fuso(acontecendo)}

    hoje = atividade_service.hoje()
    de_hoje = await sessao.scalar(_primeira(
        _minhas_atividades(aluno, "confirmada")
        .where(Atividade.situacao == "publicada", Atividade.data == hoje)
    ))
    if de_hoje is not None:
        ja_fez_checkin = await sessao.scalar(
            select(Inscricao.checkin_em).where(Inscricao.atividade_id == de_hoje.id,
                                               Inscricao.usuario_id == aluno.id)
        )
        return {
            "tipo": "evento_hoje",
            "titulo": f"{de_hoje.titulo} é hoje",
            "mensagem": ("Sua presença já foi registrada." if ja_fez_checkin else
                         f"Às {de_hoje.hora_inicio.strftime('%H:%M')}, em {de_hoje.local}."),
            "atividade": _no_fuso(de_hoje),
        }

    # "Certificado novo" é o que a pessoa ainda não viu: o aviso não lido é a
    # única marca honesta disso — o certificado em si não guarda leitura.
    novos = int(await sessao.scalar(
        select(func.count()).select_from(Notificacao)
        .where(Notificacao.destinatario_id == aluno.id,
               Notificacao.tipo == "certificado.emitido",
               Notificacao.lida_em.is_(None))
    ) or 0)
    if novos:
        return {"tipo": "certificado_novo",
                "titulo": ("Você tem 1 certificado novo" if novos == 1
                           else f"Você tem {novos} certificados novos"),
                "mensagem": "Baixe o PDF ou compartilhe o link de verificação.",
                "quantidade": novos}

    return {"tipo": "nenhum",
            "titulo": "Nenhuma atividade por vir",
            "mensagem": "Encontre uma vaga aberta e comece a somar horas."}


async def do_estudante(sessao: AsyncSession, aluno: Usuario) -> dict:
    validos = (Certificado.usuario_id == aluno.id, Certificado.revogado_em.is_(None))
    certificados, horas = (await sessao.execute(
        select(func.count(Certificado.id),
               func.coalesce(func.sum(Certificado.horas), 0)).where(*validos)
    )).one()

    proxima = await sessao.scalar(_primeira(
        _minhas_atividades(aluno, "confirmada", "pendente")
        .where(*atividade_service.condicao_de_situacao("publicada"))
    ))

    return {
        "horasValidadas": int(horas or 0),
        "certificados": int(certificados or 0),
        "inscricoesAtivas": await inscricao_service.contar_ativas(sessao, aluno.id),
        "limiteInscricoes": inscricao_service.LIMITE_DE_INSCRICOES_ATIVAS,
        "proximaAtividade": _no_fuso(proxima) if proxima is not None else None,
        "destaque": await _destaque_do_aluno(sessao, aluno),
    }


# ===================== O1 — ONG =====================


def _minhas(ong: Usuario) -> Select:
    return select(Atividade).where(Atividade.ong_id == ong.id)


async def _contar_atividades(sessao: AsyncSession, ong: Usuario, situacao: str) -> int:
    return int(await sessao.scalar(
        select(func.count()).select_from(Atividade)
        .where(Atividade.ong_id == ong.id,
               *atividade_service.condicao_de_situacao(situacao))
    ) or 0)


async def _destaque_da_ong(sessao: AsyncSession, ong: Usuario, *,
                           pendentes: int, rascunhos: int) -> dict:
    acontecendo = await sessao.scalar(_primeira(
        _minhas(ong).where(*atividade_service.condicao_de_situacao("em_andamento"))))
    if acontecendo is not None:
        return {"tipo": "checkin_disponivel",
                "titulo": f"{acontecendo.titulo} está acontecendo agora",
                "mensagem": "Abra o painel de check-in para os voluntários escanearem.",
                "atividade": _no_fuso(acontecendo)}

    a_validar = await sessao.scalar(_primeira(
        _minhas(ong).where(*atividade_service.condicao_de_situacao("aguardando_validacao"))))
    if a_validar is not None:
        return {"tipo": "validar_presencas",
                "titulo": f"{a_validar.titulo} terminou e espera validação",
                "mensagem": "Confirme quem esteve presente para os certificados saírem.",
                "atividade": _no_fuso(a_validar)}

    if pendentes:
        return {"tipo": "inscricoes_pendentes",
                "titulo": ("1 pessoa aguardando aprovação" if pendentes == 1
                           else f"{pendentes} pessoas aguardando aprovação"),
                "mensagem": "Avalie os pedidos antes do dia da atividade.",
                "quantidade": pendentes}

    if rascunhos:
        return {"tipo": "rascunho_parado",
                "titulo": ("Você tem 1 rascunho não publicado" if rascunhos == 1
                           else f"Você tem {rascunhos} rascunhos não publicados"),
                "mensagem": "Enquanto não for publicado, ninguém vê a vaga.",
                "quantidade": rascunhos}

    return {"tipo": "nenhum",
            "titulo": "Nada pendente por aqui",
            "mensagem": "Publique uma atividade para receber voluntários."}


async def da_ong(sessao: AsyncSession, ong: Usuario) -> dict:
    hoje, agora = atividade_service.hoje(), atividade_service.agora().time()
    # "Publicadas" na tela junta as que ainda vão acontecer e a que está
    # rolando: as duas estão gravadas como `publicada` e se separam pelo
    # relógio (RN-54). O que já terminou sai da conta.
    no_ar = int(await sessao.scalar(
        select(func.count()).select_from(Atividade)
        .where(Atividade.ong_id == ong.id, Atividade.situacao == "publicada",
               or_(Atividade.data > hoje,
                   and_(Atividade.data == hoje, Atividade.hora_fim >= agora)))
    ) or 0)

    das_minhas = select(Atividade.id).where(Atividade.ong_id == ong.id)

    # Pessoas, não inscrições: quem voltou em três ações conta uma vez.
    voluntarios = int(await sessao.scalar(
        select(func.count(func.distinct(Inscricao.usuario_id)))
        .where(Inscricao.atividade_id.in_(das_minhas),
               Inscricao.situacao.in_(SITUACOES_ENGAJADAS))
    ) or 0)
    certificados = int(await sessao.scalar(
        select(func.count()).select_from(Certificado)
        .where(Certificado.atividade_id.in_(das_minhas),
               Certificado.revogado_em.is_(None))
    ) or 0)
    pendentes = int(await sessao.scalar(
        select(func.count()).select_from(Inscricao)
        .where(Inscricao.atividade_id.in_(das_minhas),
               Inscricao.situacao == "pendente")
    ) or 0)
    rascunhos = await _contar_atividades(sessao, ong, "rascunho")

    return {
        "atividadesPublicadas": no_ar,
        "voluntariosEngajados": voluntarios,
        "certificadosEmitidos": certificados,
        "inscricoesPendentes": pendentes,
        "rascunhos": rascunhos,
        "aguardandoValidacao": await _contar_atividades(sessao, ong,
                                                        "aguardando_validacao"),
        "destaque": await _destaque_da_ong(sessao, ong, pendentes=pendentes,
                                           rascunhos=rascunhos),
    }
