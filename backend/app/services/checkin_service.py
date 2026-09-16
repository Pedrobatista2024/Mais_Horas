"""
Check-in por QR rotativo e validação de presença.

O ataque que isto impede é concreto: o aluno não vai, pede ao colega uma foto do
QR pelo WhatsApp e registra presença de casa. Por isso o código na tela da ONG
troca a cada 30 s e morre 10 s depois de trocar — quando a foto chega, já não
vale. Para fraudar seria preciso um cúmplice mandando print novo a cada meio
minuto, ao vivo: custa mais que ir ao evento.

O check-in é **evidência, não decisão** (RN-23). Quem define presença é a ONG em
`O7`, e a divergência entre o que o QR registrou e o que a ONG decidiu fica
visível — é justamente o que se quer poder auditar.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from fastapi import Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import auditoria, security
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import Atividade, Inscricao, PerfilEstudante, Usuario
from app.services import certificado_service
from app.services.atividade_service import agora, situacao_real
from app.services.inscricao_service import _serializar_aluno

# Quem pode receber presença: esteve inscrito e confirmado até o fim.
SITUACOES_VALIDAVEIS = ("confirmada", "presente", "ausente")

# Com que frequência a abertura do painel volta a ser registrada. O cliente
# rebusca o token a cada 30 s, e auditar cada busca encheria a trilha de ruído
# sem dizer nada novo.
INTERVALO_DE_AUDITORIA_DO_PAINEL = timedelta(minutes=15)

MOTIVO_PARA_ERRO = {
    "expirado": ("token_expirado",
                 "Este código já venceu. Aponte de novo para a tela"),
    "assinatura_invalida": ("token_invalido", "Código inválido"),
    "malformado": ("token_invalido", "Código inválido"),
}


# ===================== Painel da ONG (O6) =====================


async def _exigir_atividade_da_ong(sessao: AsyncSession, ong: Usuario,
                                   atividade_id: uuid.UUID) -> Atividade:
    atividade = await sessao.get(Atividade, atividade_id)
    if atividade is None:
        raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                            status.HTTP_404_NOT_FOUND)
    if atividade.ong_id != ong.id:
        raise ErroDeNegocio("nao_e_dono", "Esta atividade é de outra organização",
                            status.HTTP_403_FORBIDDEN)
    return atividade


async def _auditar_abertura(sessao: AsyncSession, ong: Usuario,
                            atividade: Atividade, request: Request | None) -> None:
    """Registra a abertura do painel no máximo uma vez a cada 15 minutos."""
    recente = await sessao.scalar(
        select(func.count()).select_from(auditoria.RegistroAuditoria).where(
            auditoria.RegistroAuditoria.acao == "checkin.painel_aberto",
            auditoria.RegistroAuditoria.entidade_id == atividade.id,
            auditoria.RegistroAuditoria.ocorrido_em
            >= agora() - INTERVALO_DE_AUDITORIA_DO_PAINEL,
        )
    )
    if recente:
        return
    await auditoria.registrar(
        sessao, "checkin.painel_aberto", ator_id=ong.id, ator_papel=ong.papel,
        entidade="atividade", entidade_id=atividade.id, request=request,
    )
    await sessao.commit()


async def token_do_painel(sessao: AsyncSession, ong: Usuario,
                          atividade_id: uuid.UUID, *,
                          request: Request | None = None) -> dict:
    atividade = await _exigir_atividade_da_ong(sessao, ong, atividade_id)

    if situacao_real(atividade) != "em_andamento":
        raise ErroDeNegocio(
            "checkin_fora_da_janela",
            "O check-in só abre no horário da atividade",
            status.HTTP_403_FORBIDDEN,
        )

    await _auditar_abertura(sessao, ong, atividade, request)

    restante = security.segundos_ate_proximo_token()
    return {
        "token": security.gerar_token_checkin(atividade.id),
        "validoPor": restante,
        "expiraEm": (agora() + timedelta(seconds=restante)).isoformat(),
    }


def _linha_do_painel(inscricao: Inscricao, aluno: dict) -> dict:
    return {
        "inscricaoId": str(inscricao.id),
        "aluno": aluno,
        "situacao": inscricao.situacao,
        "checkinEm": (inscricao.checkin_em.isoformat()
                      if inscricao.checkin_em else None),
        "checkinOrigem": inscricao.checkin_origem,
    }


async def _inscritos(sessao: AsyncSession, atividade_id: uuid.UUID) -> list[Inscricao]:
    resultado = await sessao.scalars(
        select(Inscricao)
        .where(Inscricao.atividade_id == atividade_id,
               Inscricao.situacao.in_(SITUACOES_VALIDAVEIS))
        .options(selectinload(Inscricao.usuario))
        .order_by(Inscricao.checkin_em.desc().nullslast(), Inscricao.criado_em.asc())
    )
    return list(resultado)


async def painel(sessao: AsyncSession, ong: Usuario,
                 atividade_id: uuid.UUID) -> dict:
    """Lista ao vivo de `O6`: quem já chegou, em ordem de chegada."""
    atividade = await _exigir_atividade_da_ong(sessao, ong, atividade_id)
    inscritos = await _inscritos(sessao, atividade_id)

    linhas = []
    for inscricao in inscritos:
        perfil = await sessao.get(PerfilEstudante, inscricao.usuario_id)
        linhas.append(_linha_do_painel(
            inscricao, _serializar_aluno(inscricao.usuario, perfil)))

    return {
        "atividade": {
            "id": str(atividade.id),
            "titulo": atividade.titulo,
            "situacao": situacao_real(atividade),
        },
        "presentes": sum(1 for i in inscritos if i.checkin_em),
        "inscritos": len(inscritos),
        "itens": linhas,
    }


# ===================== Check-in do aluno (E5) =====================


async def _auditar_token_invalido(sessao: AsyncSession, aluno: Usuario, motivo: str,
                                  atividade_id: uuid.UUID | None,
                                  request: Request | None) -> None:
    await auditoria.registrar(
        sessao, "checkin.token_invalido", ator_id=aluno.id, ator_papel=aluno.papel,
        entidade="atividade", entidade_id=atividade_id,
        depois={"motivo": motivo}, request=request,
    )
    await sessao.commit()


async def registrar(sessao: AsyncSession, aluno: Usuario, token: str, *,
                    latitude: float | None = None, longitude: float | None = None,
                    request: Request | None = None) -> dict:
    lido = security.ler_token_checkin(token)

    if not lido.valido:
        await _auditar_token_invalido(sessao, aluno, lido.motivo or "desconhecido",
                                      lido.atividade_id, request)
        codigo, mensagem = MOTIVO_PARA_ERRO.get(
            lido.motivo or "", ("token_invalido", "Código inválido"))
        raise ErroDeNegocio(codigo, mensagem)

    atividade = await sessao.get(Atividade, lido.atividade_id)
    if atividade is None:
        raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                            status.HTTP_404_NOT_FOUND)

    if situacao_real(atividade) != "em_andamento":
        raise ErroDeNegocio("checkin_fora_da_janela", "O check-in não está aberto")

    inscricao = await sessao.scalar(
        select(Inscricao).where(Inscricao.atividade_id == atividade.id,
                                Inscricao.usuario_id == aluno.id)
    )
    if inscricao is None or inscricao.situacao not in SITUACOES_VALIDAVEIS:
        # Serve também para o caso E2 do fluxo: o código é de uma atividade real,
        # mas não é a do aluno.
        raise ErroDeNegocio("sem_inscricao_confirmada",
                            "Você não está inscrito nesta atividade",
                            status.HTTP_403_FORBIDDEN)

    if inscricao.checkin_em is not None:
        raise ErroDeNegocio("checkin_ja_registrado",
                            "Você já registrou presença nesta atividade",
                            status.HTTP_409_CONFLICT)

    inscricao.checkin_em = agora()
    inscricao.checkin_origem = "qr"
    inscricao.checkin_latitude = latitude
    inscricao.checkin_longitude = longitude

    await auditoria.registrar(
        sessao, "checkin.registrado", ator_id=aluno.id, ator_papel=aluno.papel,
        entidade="inscricao", entidade_id=inscricao.id,
        depois={"origem": "qr", "atividade_id": str(atividade.id)}, request=request,
    )
    await sessao.commit()

    return {
        "inscricaoId": str(inscricao.id),
        "atividade": {"id": str(atividade.id), "titulo": atividade.titulo},
        "checkinEm": inscricao.checkin_em.isoformat(),
        "origem": "qr",
    }


async def registrar_manual(sessao: AsyncSession, ong: Usuario,
                           atividade_id: uuid.UUID, inscricao_id: uuid.UUID, *,
                           request: Request | None = None) -> dict:
    """
    FO-08 — a saída para quem foi ao evento sem celular, sem bateria ou sem rede.

    Sem ela a tecnologia puniria justamente quem compareceu. A origem fica
    gravada como `manual` (RN-43), então dá para separar o que o QR provou do
    que a ONG afirmou.
    """
    atividade = await _exigir_atividade_da_ong(sessao, ong, atividade_id)

    if situacao_real(atividade) != "em_andamento":
        raise ErroDeNegocio("checkin_fora_da_janela",
                            "O check-in não está aberto")

    inscricao = await sessao.get(Inscricao, inscricao_id)
    if inscricao is None or inscricao.atividade_id != atividade.id:
        raise ErroDeNegocio("nao_encontrado", "Inscrição não encontrada",
                            status.HTTP_404_NOT_FOUND)
    if inscricao.situacao not in SITUACOES_VALIDAVEIS:
        raise ErroDeNegocio("sem_inscricao_confirmada",
                            "Este aluno não está inscrito na atividade",
                            status.HTTP_403_FORBIDDEN)
    if inscricao.checkin_em is not None:
        raise ErroDeNegocio("checkin_ja_registrado",
                            "Este aluno já registrou presença",
                            status.HTTP_409_CONFLICT)

    inscricao.checkin_em = agora()
    inscricao.checkin_origem = "manual"
    inscricao.checkin_registrado_por = ong.id

    await auditoria.registrar(
        sessao, "checkin.registrado", ator_id=ong.id, ator_papel=ong.papel,
        entidade="inscricao", entidade_id=inscricao.id,
        depois={"origem": "manual", "aluno_id": str(inscricao.usuario_id)},
        request=request,
    )
    await sessao.commit()

    usuario = await sessao.get(Usuario, inscricao.usuario_id)
    perfil = await sessao.get(PerfilEstudante, inscricao.usuario_id)
    return _linha_do_painel(inscricao, _serializar_aluno(usuario, perfil))


# ===================== Validação de presença (O7) =====================


async def listar_para_validacao(sessao: AsyncSession, ong: Usuario,
                                atividade_id: uuid.UUID) -> dict:
    """
    A lista de `O7`, já pré-preenchida: quem fez check-in vem sugerido presente.

    A sugestão é do servidor porque é ele que sabe o que o QR registrou. A ONG
    continua livre para discordar — quem foi embora cedo tem check-in e pode ser
    marcado ausente, e a divergência fica no histórico.
    """
    atividade = await _exigir_atividade_da_ong(sessao, ong, atividade_id)
    inscritos = await _inscritos(sessao, atividade_id)

    itens = []
    for inscricao in inscritos:
        perfil = await sessao.get(PerfilEstudante, inscricao.usuario_id)
        linha = _linha_do_painel(
            inscricao, _serializar_aluno(inscricao.usuario, perfil))
        linha["decidida"] = inscricao.situacao in ("presente", "ausente")
        linha["sugestao"] = ("presente" if inscricao.checkin_em else "ausente")
        itens.append(linha)

    return {
        "atividade": {
            "id": str(atividade.id),
            "titulo": atividade.titulo,
            "cargaHoraria": atividade.carga_horaria,
            "situacao": situacao_real(atividade),
        },
        "comCheckin": sum(1 for i in inscritos if i.checkin_em),
        "semDecisao": sum(1 for i in inscritos
                          if i.situacao not in ("presente", "ausente")),
        "itens": itens,
    }


def _exigir_janela_de_validacao(atividade: Atividade) -> None:
    situacao = situacao_real(atividade)
    if situacao == "finalizada":
        raise ErroDeNegocio("situacao_invalida", "Esta atividade já foi finalizada")
    if situacao != "aguardando_validacao":
        raise ErroDeNegocio(
            "situacao_invalida",
            "A presença só é validada depois que a atividade termina")


async def definir_presenca(sessao: AsyncSession, ong: Usuario,
                           inscricao_id: uuid.UUID, situacao: str, *,
                           request: Request | None = None) -> dict:
    """
    `PUT /inscricoes/{id}/presenca` — **confere o dono** (RN-11).

    A checagem vem daqui, do serviço, e não só do papel na rota: era exatamente
    o que faltava na versão anterior, onde uma ONG conseguia marcar presença em
    atividade alheia (falha L2 de docs/requisitos.md).
    """
    inscricao = await sessao.scalar(
        select(Inscricao).where(Inscricao.id == inscricao_id)
        .options(selectinload(Inscricao.atividade))
    )
    if inscricao is None:
        raise ErroDeNegocio("nao_encontrado", "Inscrição não encontrada",
                            status.HTTP_404_NOT_FOUND)
    if inscricao.atividade.ong_id != ong.id:
        raise ErroDeNegocio("nao_e_dono",
                            "Esta inscrição é de uma atividade de outra organização",
                            status.HTTP_403_FORBIDDEN)

    _exigir_janela_de_validacao(inscricao.atividade)

    if inscricao.situacao not in SITUACOES_VALIDAVEIS:
        raise ErroDeNegocio(
            "situacao_invalida",
            "Só quem teve a inscrição confirmada recebe presença")

    anterior = inscricao.situacao
    inscricao.situacao = situacao
    inscricao.presenca_validada_em = agora()
    inscricao.presenca_validada_por = ong.id

    await auditoria.registrar(
        sessao, "presenca.validada", ator_id=ong.id, ator_papel=ong.papel,
        entidade="inscricao", entidade_id=inscricao.id,
        antes={"situacao": anterior},
        depois={"situacao": situacao,
                # Divergir do check-in é legítimo, mas fica dito.
                "teve_checkin": inscricao.checkin_em is not None},
        request=request,
    )
    await sessao.commit()

    usuario = await sessao.get(Usuario, inscricao.usuario_id)
    perfil = await sessao.get(PerfilEstudante, inscricao.usuario_id)
    linha = _linha_do_painel(inscricao, _serializar_aluno(usuario, perfil))
    linha["decidida"] = True
    return linha


async def definir_presencas_em_lote(sessao: AsyncSession, ong: Usuario,
                                    atividade_id: uuid.UUID,
                                    decisoes: list[dict], *,
                                    request: Request | None = None) -> dict:
    """Atende "marcar todos os check-ins" e "marcar restantes" numa requisição."""
    atividade = await _exigir_atividade_da_ong(sessao, ong, atividade_id)
    _exigir_janela_de_validacao(atividade)

    por_id = {str(d["inscricaoId"]): d["situacao"] for d in decisoes}
    alteradas = 0

    for inscricao in await _inscritos(sessao, atividade_id):
        nova = por_id.get(str(inscricao.id))
        if nova is None or nova == inscricao.situacao:
            continue
        anterior = inscricao.situacao
        inscricao.situacao = nova
        inscricao.presenca_validada_em = agora()
        inscricao.presenca_validada_por = ong.id
        alteradas += 1
        await auditoria.registrar(
            sessao, "presenca.validada", ator_id=ong.id, ator_papel=ong.papel,
            entidade="inscricao", entidade_id=inscricao.id,
            antes={"situacao": anterior},
            depois={"situacao": nova,
                    "teve_checkin": inscricao.checkin_em is not None},
            request=request,
        )

    await sessao.commit()
    return {"alteradas": alteradas}


async def finalizar(sessao: AsyncSession, ong: Usuario, atividade_id: uuid.UUID,
                    *, request: Request | None = None) -> dict:
    """
    Fecha a atividade, credita as horas e emite os certificados (RN-14, D4).

    Tudo numa transação só (RN-41): se uma assinatura falhar, nenhum
    certificado sai e a atividade continua aberta para nova tentativa. Um
    certificado pela metade seria pior que nenhum — o aluno o apresentaria e a
    verificação o acusaria.
    """
    atividade = await _exigir_atividade_da_ong(sessao, ong, atividade_id)
    _exigir_janela_de_validacao(atividade)
    certificado_service.exigir_chave()

    if not atividade.carga_horaria or atividade.carga_horaria <= 0:
        raise ErroDeNegocio("carga_horaria_invalida",
                            "Defina a carga horária antes de finalizar")

    inscritos = await _inscritos(sessao, atividade_id)
    pendentes = [i for i in inscritos if i.situacao not in ("presente", "ausente")]
    if pendentes:
        # RN-03. Finalizar com alguém sem decisão deixaria a pessoa num limbo:
        # nem recebe certificado nem sabe que faltou.
        raise ErroDeNegocio(
            "presencas_pendentes",
            f"{len(pendentes)} participante(s) ainda sem definição",
            detalhes=[{"campo": str(i.id), "mensagem": "Sem decisão de presença"}
                      for i in pendentes],
        )

    presentes = [i for i in inscritos if i.situacao == "presente"]
    for inscricao in inscritos:
        inscricao.carga_horaria_creditada = (
            atividade.carga_horaria if inscricao.situacao == "presente" else 0)

    atividade.situacao = "finalizada"
    atividade.finalizada_em = agora()

    emitidos = await certificado_service.emitir_para_atividade(
        sessao, ong, atividade, presentes, request=request)

    await auditoria.registrar(
        sessao, "atividade.finalizada", ator_id=ong.id, ator_papel=ong.papel,
        entidade="atividade", entidade_id=atividade.id,
        antes={"situacao": "aguardando_validacao"},
        depois={"situacao": "finalizada", "presentes": len(presentes),
                "ausentes": len(inscritos) - len(presentes),
                "certificados": emitidos},
        request=request,
    )
    await sessao.commit()

    return {
        "id": str(atividade.id),
        "situacao": "finalizada",
        "presentes": len(presentes),
        "ausentes": len(inscritos) - len(presentes),
        "certificadosEmitidos": emitidos,
        "cargaHoraria": atividade.carga_horaria,
    }
