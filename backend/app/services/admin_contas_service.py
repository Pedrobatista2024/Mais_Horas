"""
Console administrativo — contas e ONGs (A3, A4, A5).

Os poderes do superadmin são limitados de propósito, e as ausências são a
garantia:

- **não define nem vê senha** (D12, RN-28) — só dispara o link de redefinição;
- **não troca o e-mail de ninguém** — trocar e em seguida disparar a
  redefinição entregaria o link ao próprio admin, que entraria como a pessoa;
- **suspender não apaga nada** (RN-40).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria, security
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import (
    Atividade, Certificado, Inscricao, PerfilEstudante, PerfilOng, TokenSessao,
    Usuario,
)
from app.services import atividade_service, auth_service
from app.services.atividade_service import situacao_real


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _texto(momento: datetime | None) -> str | None:
    return momento.isoformat() if momento else None


async def _buscar(sessao: AsyncSession, usuario_id: uuid.UUID) -> Usuario:
    usuario = await sessao.get(Usuario, usuario_id)
    if usuario is None:
        raise ErroDeNegocio("nao_encontrado", "Usuário não encontrado",
                            status.HTTP_404_NOT_FOUND)
    return usuario


def _ultimo_acesso():
    """Última sessão aberta — o login mais recente."""
    return (select(func.max(TokenSessao.criado_em))
            .where(TokenSessao.usuario_id == Usuario.id)
            .correlate(Usuario).scalar_subquery())


def _resumo(usuario: Usuario, ultimo_acesso: datetime | None) -> dict:
    return {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "email": usuario.email,
        "papel": usuario.papel,
        "situacao": usuario.situacao,
        "criadoEm": _texto(usuario.criado_em),
        "ultimoAcesso": _texto(ultimo_acesso),
    }


# ===================== Listagem e detalhe =====================


async def listar(sessao: AsyncSession, *, papel: str | None = None,
                 situacao: str | None = None, busca: str | None = None,
                 pagina: int = 1, tamanho: int = 20) -> tuple[list[dict], int]:
    condicoes = []
    if papel in ("estudante", "ong", "superadmin"):
        condicoes.append(Usuario.papel == papel)
    if situacao in ("ativa", "suspensa"):
        condicoes.append(Usuario.situacao == situacao)
    if busca and busca.strip():
        alvo = f"%{busca.strip()}%"
        condicoes.append(or_(Usuario.nome.ilike(alvo), Usuario.email.ilike(alvo)))

    total = int(await sessao.scalar(
        select(func.count()).select_from(Usuario).where(*condicoes)) or 0)
    linhas = await sessao.execute(
        select(Usuario, _ultimo_acesso().label("ultimo"))
        .where(*condicoes)
        .order_by(Usuario.criado_em.desc())
        .offset((pagina - 1) * tamanho).limit(tamanho))
    return [_resumo(u, ultimo) for u, ultimo in linhas], total


async def detalhar(sessao: AsyncSession, admin: Usuario, usuario_id: uuid.UUID,
                   *, request: Request | None = None) -> dict:
    """
    A4. Ler o detalhe de alguém é ler dado pessoal, e a RN-32 manda auditar
    também a leitura sensível.
    """
    usuario = await _buscar(sessao, usuario_id)
    agora = _agora()

    sessoes = await sessao.scalars(
        select(TokenSessao)
        .where(TokenSessao.usuario_id == usuario.id,
               TokenSessao.revogado_em.is_(None),
               TokenSessao.usado_em.is_(None),
               TokenSessao.expira_em > agora)
        .order_by(TokenSessao.criado_em.desc()))

    perfil: dict | None = None
    if usuario.papel == "estudante":
        p = await sessao.get(PerfilEstudante, usuario.id)
        if p:
            perfil = {"nomeCompleto": p.nome_completo, "instituicao": p.instituicao,
                      "curso": p.curso, "telefone": p.telefone, "cidade": p.cidade}
    elif usuario.papel == "ong":
        p = await sessao.get(PerfilOng, usuario.id)
        if p:
            perfil = {"nomeOrganizacao": p.nome_organizacao, "cnpj": p.cnpj,
                      "telefone": p.telefone, "cidade": p.cidade,
                      "verificada": p.verificada_em is not None}

    contagens = {
        "inscricoes": int(await sessao.scalar(
            select(func.count()).select_from(Inscricao)
            .where(Inscricao.usuario_id == usuario.id)) or 0),
        "certificados": int(await sessao.scalar(
            select(func.count()).select_from(Certificado)
            .where(Certificado.usuario_id == usuario.id)) or 0),
        "atividades": int(await sessao.scalar(
            select(func.count()).select_from(Atividade)
            .where(Atividade.ong_id == usuario.id)) or 0),
    }

    ultimo = await sessao.scalar(
        select(func.max(TokenSessao.criado_em))
        .where(TokenSessao.usuario_id == usuario.id))

    await auditoria.registrar(
        sessao, "usuario.consultado", ator_id=admin.id, ator_papel=admin.papel,
        entidade="usuario", entidade_id=usuario.id, request=request)
    await sessao.commit()

    return {
        **_resumo(usuario, ultimo),
        "suspensoEm": _texto(usuario.suspenso_em),
        "motivoSuspensao": usuario.motivo_suspensao,
        "perfil": perfil,
        "contagens": contagens,
        "sessoesAtivas": [
            {"id": str(s.id), "ip": s.ip, "dispositivo": s.user_agent,
             "abertaEm": _texto(s.criado_em), "expiraEm": _texto(s.expira_em),
             "espelho": s.em_nome_de is not None}
            for s in sessoes
        ],
    }


# ===================== Ações sobre a conta =====================


async def redefinir_senha(sessao: AsyncSession, admin: Usuario,
                          usuario_id: uuid.UUID, *,
                          request: Request | None = None) -> dict:
    """FS-03 — dispara o link. O admin nunca vê nem escolhe a senha (D12)."""
    usuario = await _buscar(sessao, usuario_id)
    if usuario.situacao != "ativa":
        raise ErroDeNegocio("conta_suspensa",
                            "Reative a conta antes de redefinir a senha")
    await auth_service.pedir_redefinicao(
        sessao, usuario.email, disparado_por=admin.id, request=request)
    return {"enviadoPara": usuario.email}


async def _admins_ativos(sessao: AsyncSession, exceto: uuid.UUID) -> int:
    return int(await sessao.scalar(
        select(func.count()).select_from(Usuario)
        .where(Usuario.papel == "superadmin", Usuario.situacao == "ativa",
               Usuario.id != exceto)) or 0)


async def suspender(sessao: AsyncSession, admin: Usuario, usuario_id: uuid.UUID,
                    motivo: str, *, request: Request | None = None) -> dict:
    """
    FS-05. Tira o acesso e derruba as sessões. Sendo ONG, **cancela as
    atividades que ainda não começaram** (RN-51) — reativar a conta não as
    reabre, porque os inscritos já foram avisados e liberados.

    As que já começaram ficam como estão: cancelar depois do evento negaria o
    certificado de quem foi. Elas saem da vitrine (RN-36) e o admin pode
    forçar a validação (FS-08).
    """
    usuario = await _buscar(sessao, usuario_id)
    if usuario.id == admin.id:
        raise ErroDeNegocio("nao_pode_suspender_a_si_mesmo",
                            "Você não pode suspender a própria conta")
    if usuario.situacao == "suspensa":
        raise ErroDeNegocio("ja_suspensa", "Esta conta já está suspensa")
    # RN-44. Pela API isto não chega a disparar — quem age é um admin ativo e
    # não pode ser o alvo —, mas a regra não deve depender de quem chama.
    if usuario.papel == "superadmin" and await _admins_ativos(sessao, usuario.id) == 0:
        raise ErroDeNegocio("ultimo_admin_ativo",
                            "É preciso haver ao menos um administrador ativo")

    usuario.situacao = "suspensa"
    usuario.suspenso_em = _agora()
    usuario.suspenso_por = admin.id
    usuario.motivo_suspensao = motivo.strip()
    await auth_service.revogar_todas_as_sessoes(sessao, usuario.id)

    canceladas = 0
    if usuario.papel == "ong":
        futuras = await sessao.scalars(
            select(Atividade).where(Atividade.ong_id == usuario.id,
                                    Atividade.situacao == "publicada"))
        for atividade in futuras:
            if situacao_real(atividade) == "publicada":
                await atividade_service.encerrar_por_cancelamento(
                    sessao, atividade, admin,
                    f"Organização suspensa: {usuario.motivo_suspensao}",
                    request=request)
                canceladas += 1

    await auditoria.registrar(
        sessao, "conta.suspensa", ator_id=admin.id, ator_papel=admin.papel,
        entidade="usuario", entidade_id=usuario.id,
        depois={"motivo": usuario.motivo_suspensao,
                "atividades_canceladas": canceladas},
        request=request)
    await sessao.commit()
    return {**_resumo(usuario, None), "atividadesCanceladas": canceladas}


async def reativar(sessao: AsyncSession, admin: Usuario, usuario_id: uuid.UUID,
                   *, request: Request | None = None) -> dict:
    usuario = await _buscar(sessao, usuario_id)
    if usuario.situacao == "ativa":
        raise ErroDeNegocio("ja_ativa", "Esta conta já está ativa")

    antes = {"motivo": usuario.motivo_suspensao,
             "suspenso_em": _texto(usuario.suspenso_em)}
    usuario.situacao = "ativa"
    usuario.suspenso_em = None
    usuario.suspenso_por = None
    usuario.motivo_suspensao = None

    await auditoria.registrar(
        sessao, "conta.reativada", ator_id=admin.id, ator_papel=admin.papel,
        entidade="usuario", entidade_id=usuario.id, antes=antes, request=request)
    await sessao.commit()
    return _resumo(usuario, None)


async def encerrar_sessoes(sessao: AsyncSession, admin: Usuario,
                           usuario_id: uuid.UUID, *,
                           request: Request | None = None) -> dict:
    """FS-06 — suspeita de conta comprometida."""
    usuario = await _buscar(sessao, usuario_id)
    await auth_service.revogar_todas_as_sessoes(sessao, usuario.id)
    await auditoria.registrar(
        sessao, "sessoes.revogadas", ator_id=admin.id, ator_papel=admin.papel,
        entidade="usuario", entidade_id=usuario.id, request=request)
    await sessao.commit()
    return {"ok": True}


async def criar_admin(sessao: AsyncSession, admin: Usuario, nome: str, email: str,
                      senha_atual: str, *, request: Request | None = None) -> dict:
    """
    FS-10. A reconfirmação de senha (RN-37) impede que uma sessão esquecida
    aberta vire uma fábrica de administradores.

    A conta nasce **sem senha utilizável**: o hash é de um valor aleatório que
    ninguém conhece, e o novo admin define a própria senha pelo link (D12).
    """
    if not security.conferir_senha(senha_atual, admin.senha_hash):
        raise ErroDeNegocio("senha_atual_incorreta", "Senha incorreta",
                            status.HTTP_403_FORBIDDEN)

    email = email.strip().lower()
    existe = await sessao.scalar(select(Usuario.id).where(Usuario.email == email))
    if existe:
        raise ErroDeNegocio("email_em_uso", "Este e-mail já está cadastrado",
                            status.HTTP_409_CONFLICT)

    novo = Usuario(nome=nome.strip(), email=email, papel="superadmin",
                   senha_hash=security.gerar_hash_senha(security.gerar_refresh_token()))
    sessao.add(novo)
    await sessao.flush()
    await auditoria.registrar(
        sessao, "admin.criado", ator_id=admin.id, ator_papel=admin.papel,
        entidade="usuario", entidade_id=novo.id,
        depois={"email": email, "origem": "console"}, request=request)
    await sessao.commit()

    await auth_service.pedir_redefinicao(
        sessao, email, disparado_por=admin.id, request=request)
    return _resumo(novo, None)


# ===================== Entrar como (A4b, D13) =====================


def validade_do_espelho() -> timedelta:
    return timedelta(minutes=config.espelho_minutos)


async def entrar_como(sessao: AsyncSession, admin: Usuario, usuario_id: uuid.UUID,
                      *, request: Request | None = None) -> dict:
    """
    FS-04 — abre a sessão espelho: **observar, nunca se disfarçar**.

    O token carrega a identidade do alvo, mas a trilha registra o admin como
    ator e o alvo em `em_nome_de`. Nenhuma escrita passa (RN-29), e em 30
    minutos acaba, sem renovação (RN-31).
    """
    alvo = await _buscar(sessao, usuario_id)
    if alvo.papel == "superadmin":
        raise ErroDeNegocio("nao_pode_espelhar_admin",
                            "Não é possível entrar como outro administrador",
                            status.HTTP_403_FORBIDDEN)
    if alvo.situacao != "ativa":
        raise ErroDeNegocio("conta_suspensa", "Reative a conta primeiro",
                            status.HTTP_403_FORBIDDEN)

    agora = _agora()
    expira_em = agora + validade_do_espelho()
    ip, user_agent = auditoria.contexto(request)
    registro = TokenSessao(
        usuario_id=alvo.id,
        # O hash é de um valor que ninguém recebe: esta linha não serve como
        # refresh, só como registro revogável da sessão espelho.
        token_hash=security.hash_refresh_token(security.gerar_refresh_token()),
        familia_id=uuid.uuid4(),
        expira_em=expira_em,
        em_nome_de=admin.id,
        user_agent=(user_agent or "")[:400] or None,
        ip=(ip or "")[:64] or None,
    )
    sessao.add(registro)
    await sessao.flush()

    await auditoria.registrar(
        sessao, "admin.entrou_como", ator_id=admin.id, ator_papel=admin.papel,
        em_nome_de_id=alvo.id, entidade="usuario", entidade_id=alvo.id,
        depois={"expira_em": expira_em.isoformat()}, request=request)
    await sessao.commit()

    token = security.criar_token_espelho(alvo.id, alvo.papel, admin.id,
                                         registro.id, expira_em)
    return {
        "token": token,
        "expiraEm": expira_em.isoformat(),
        "usuario": {"id": str(alvo.id), "nome": alvo.nome, "email": alvo.email,
                    "papel": alvo.papel},
        "admin": {"id": str(admin.id), "nome": admin.nome},
    }


async def sair_do_modo(sessao: AsyncSession, admin: Usuario, alvo: Usuario,
                       sessao_id: uuid.UUID, *,
                       request: Request | None = None) -> dict:
    registro = await sessao.get(TokenSessao, sessao_id)
    if registro is not None and registro.revogado_em is None:
        registro.revogado_em = _agora()
    await auditoria.registrar(
        sessao, "admin.saiu_do_modo", ator_id=admin.id, ator_papel=admin.papel,
        em_nome_de_id=alvo.id, entidade="usuario", entidade_id=alvo.id,
        request=request)
    await sessao.commit()
    return {"alvoId": str(alvo.id)}


# ===================== ONGs (A5) =====================


async def listar_ongs(sessao: AsyncSession, *, busca: str | None = None,
                      verificada: bool | None = None, pagina: int = 1,
                      tamanho: int = 20) -> tuple[list[dict], int]:
    condicoes = [Usuario.papel == "ong"]
    if busca and busca.strip():
        alvo = f"%{busca.strip()}%"
        condicoes.append(or_(Usuario.nome.ilike(alvo), Usuario.email.ilike(alvo),
                             PerfilOng.nome_organizacao.ilike(alvo),
                             PerfilOng.cnpj.ilike(alvo)))
    if verificada is True:
        condicoes.append(PerfilOng.verificada_em.is_not(None))
    elif verificada is False:
        condicoes.append(PerfilOng.verificada_em.is_(None))

    base = (select(Usuario, PerfilOng)
            .outerjoin(PerfilOng, PerfilOng.usuario_id == Usuario.id)
            .where(*condicoes))
    total = int(await sessao.scalar(
        select(func.count()).select_from(base.subquery())) or 0)

    atividades = (select(func.count()).select_from(Atividade)
                  .where(Atividade.ong_id == Usuario.id,
                         Atividade.situacao != "rascunho")
                  .correlate(Usuario).scalar_subquery())
    voluntarios = (select(func.count()).select_from(Inscricao)
                   .join(Atividade, Atividade.id == Inscricao.atividade_id)
                   .where(Atividade.ong_id == Usuario.id,
                          Inscricao.situacao == "presente")
                   .correlate(Usuario).scalar_subquery())
    certificados = (select(func.count()).select_from(Certificado)
                    .join(Atividade, Atividade.id == Certificado.atividade_id)
                    .where(Atividade.ong_id == Usuario.id)
                    .correlate(Usuario).scalar_subquery())

    linhas = await sessao.execute(
        base.add_columns(atividades, voluntarios, certificados)
        .order_by(Usuario.criado_em.desc())
        .offset((pagina - 1) * tamanho).limit(tamanho))

    itens = []
    for usuario, perfil, n_ativ, n_vol, n_cert in linhas:
        itens.append({
            "id": str(usuario.id),
            "nome": (perfil.nome_organizacao if perfil else None) or usuario.nome,
            "email": usuario.email,
            "cnpj": perfil.cnpj if perfil else None,
            "cidade": perfil.cidade if perfil else None,
            "situacao": usuario.situacao,
            "verificada": bool(perfil and perfil.verificada_em),
            "verificadaEm": _texto(perfil.verificada_em if perfil else None),
            "atividades": int(n_ativ or 0),
            "voluntarios": int(n_vol or 0),
            "certificados": int(n_cert or 0),
            "criadoEm": _texto(usuario.criado_em),
        })
    return itens, total


async def definir_verificacao(sessao: AsyncSession, admin: Usuario,
                              ong_id: uuid.UUID, verificada: bool, *,
                              request: Request | None = None) -> dict:
    usuario = await _buscar(sessao, ong_id)
    if usuario.papel != "ong":
        raise ErroDeNegocio("nao_e_ong", "Esta conta não é de uma organização")

    perfil = await sessao.get(PerfilOng, usuario.id)
    if perfil is None:
        perfil = PerfilOng(usuario_id=usuario.id)
        sessao.add(perfil)

    if verificada and perfil.verificada_em is None:
        perfil.verificada_em = _agora()
        perfil.verificada_por = admin.id
        acao = "ong.verificada"
    elif not verificada and perfil.verificada_em is not None:
        perfil.verificada_em = None
        perfil.verificada_por = None
        acao = "ong.verificacao_removida"
    else:
        # Nada mudou: não há o que registrar.
        return {"id": str(usuario.id), "verificada": verificada}

    await auditoria.registrar(
        sessao, acao, ator_id=admin.id, ator_papel=admin.papel,
        entidade="usuario", entidade_id=usuario.id, request=request)
    await sessao.commit()
    return {"id": str(usuario.id), "verificada": verificada}
