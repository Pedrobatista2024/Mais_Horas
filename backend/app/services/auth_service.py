"""
Regras de cadastro, autenticação e sessão.

O modelo de sessão está detalhado em docs/autenticacao.md. Em resumo: access
token curto guardado em memória pelo cliente, refresh token opaco em cookie
httpOnly, rotacionado a cada uso, com revogação da família ao detectar reuso.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria, email
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.core.security import (
    conferir_senha, criar_access_token, expiracao_refresh, gerar_hash_senha,
    gerar_refresh_token, hash_refresh_token, precisa_regravar,
)
from app.db.models import PerfilEstudante, PerfilOng, TokenRedefinicaoSenha, TokenSessao, Usuario

VALIDADE_LINK_SENHA = timedelta(hours=1)


@dataclass
class Sessao:
    """O refresh sai separado porque vai para o cookie, nunca para o corpo."""

    usuario: Usuario
    token: str
    expira_em: int
    refresh: str


def _agora() -> datetime:
    return datetime.now(timezone.utc)


async def _abrir_sessao(
    sessao: AsyncSession, usuario: Usuario, *,
    familia_id: uuid.UUID | None = None, request: Request | None = None,
) -> Sessao:
    token, expira_em = criar_access_token(usuario.id, usuario.papel)
    bruto = gerar_refresh_token()
    ip, user_agent = auditoria.contexto(request)

    sessao.add(TokenSessao(
        usuario_id=usuario.id,
        token_hash=hash_refresh_token(bruto),
        familia_id=familia_id or uuid.uuid4(),
        expira_em=expiracao_refresh(),
        user_agent=(user_agent or "")[:400] or None,
        ip=(ip or "")[:64] or None,
    ))
    return Sessao(usuario=usuario, token=token, expira_em=expira_em, refresh=bruto)


async def _revogar_familia(sessao: AsyncSession, familia_id: uuid.UUID) -> None:
    await sessao.execute(
        update(TokenSessao)
        .where(TokenSessao.familia_id == familia_id,
               TokenSessao.revogado_em.is_(None))
        .values(revogado_em=_agora())
    )


async def revogar_todas_as_sessoes(sessao: AsyncSession, usuario_id: uuid.UUID) -> None:
    """RN-38 — usada ao redefinir senha e pelo admin (FS-06)."""
    await sessao.execute(
        update(TokenSessao)
        .where(TokenSessao.usuario_id == usuario_id,
               TokenSessao.revogado_em.is_(None))
        .values(revogado_em=_agora())
    )


# ===================== Cadastro =====================


async def cadastrar(
    sessao: AsyncSession, dados: dict, *, request: Request | None = None
) -> Sessao:
    email_normalizado = dados["email"]

    if await sessao.scalar(select(Usuario).where(Usuario.email == email_normalizado)):
        raise ErroDeNegocio("email_em_uso", "Este e-mail já está em uso",
                            status.HTTP_409_CONFLICT)

    usuario = Usuario(
        nome=dados["nome"],
        email=email_normalizado,
        senha_hash=gerar_hash_senha(dados["senha"]),
        papel=dados["papel"],
    )
    sessao.add(usuario)
    await sessao.flush()

    # O perfil nasce vazio junto com a conta: a exigência de preenchimento só
    # vale na primeira inscrição (RN-13).
    if usuario.papel == "estudante":
        sessao.add(PerfilEstudante(usuario_id=usuario.id))
    elif usuario.papel == "ong":
        sessao.add(PerfilOng(usuario_id=usuario.id))

    resultado = await _abrir_sessao(sessao, usuario, request=request)
    await auditoria.registrar(
        sessao, "conta.criada", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id, request=request,
    )
    await sessao.commit()
    await sessao.refresh(usuario)
    return resultado


# ===================== Login =====================


async def entrar(
    sessao: AsyncSession, email_informado: str, senha: str,
    *, request: Request | None = None,
) -> Sessao:
    usuario = await sessao.scalar(
        select(Usuario).where(Usuario.email == email_informado)
    )

    # Mensagem única para e-mail inexistente e senha errada (RN-22): a diferença
    # transformaria a tela de login num verificador de quais contas existem.
    if usuario is None or not conferir_senha(senha, usuario.senha_hash):
        await auditoria.registrar(
            sessao, "sessao.falha",
            ator_id=usuario.id if usuario else None,
            entidade="usuario", entidade_id=usuario.id if usuario else None,
            depois={"motivo": "credenciais"}, request=request,
        )
        await sessao.commit()
        raise ErroDeNegocio("credenciais_invalidas", "E-mail ou senha incorretos")

    if usuario.situacao != "ativa":
        await auditoria.registrar(
            sessao, "sessao.falha", ator_id=usuario.id, ator_papel=usuario.papel,
            entidade="usuario", entidade_id=usuario.id,
            depois={"motivo": "suspensa"}, request=request,
        )
        await sessao.commit()
        raise ErroDeNegocio("conta_suspensa",
                            "Esta conta está suspensa. Fale com o suporte.",
                            status.HTTP_403_FORBIDDEN)

    # Conta herdada do backend anterior: agora que a senha está em mãos, o hash
    # bcrypt é convertido para Argon2id em silêncio.
    if precisa_regravar(usuario.senha_hash):
        usuario.senha_hash = gerar_hash_senha(senha)

    resultado = await _abrir_sessao(sessao, usuario, request=request)
    await auditoria.registrar(
        sessao, "sessao.iniciada", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id, request=request,
    )
    await sessao.commit()
    return resultado


# ===================== Renovação =====================


async def renovar(
    sessao: AsyncSession, bruto: str, *, request: Request | None = None
) -> Sessao:
    """Troca o refresh por um par novo, rotacionando o antigo."""
    registro = await sessao.scalar(
        select(TokenSessao).where(TokenSessao.token_hash == hash_refresh_token(bruto))
    )
    if registro is None:
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida",
                            status.HTTP_401_UNAUTHORIZED)

    agora = _agora()

    # Revogação explícita (logout, ou família derrubada) nunca renova.
    if registro.revogado_em is not None:
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida",
                            status.HTTP_401_UNAUTHORIZED)

    if registro.usado_em is not None:
        idade = (agora - registro.usado_em).total_seconds()
        if idade > config.refresh_graca_segundos:
            # Token consumido há tempo reaparecendo: sinal de roubo.
            await _revogar_familia(sessao, registro.familia_id)
            await auditoria.registrar(
                sessao, "sessao.reuso_detectado", ator_id=registro.usuario_id,
                entidade="usuario", entidade_id=registro.usuario_id, request=request,
            )
            await sessao.commit()
            raise ErroDeNegocio("sessao_invalida", "Sessão inválida",
                                status.HTTP_401_UNAUTHORIZED)
        # Dentro da janela é corrida benigna — duas abas, retry de rede ou o
        # StrictMode do React montando o efeito duas vezes. Emite par novo em vez
        # de derrubar a sessão de quem não fez nada de errado.

    if registro.expira_em <= agora:
        raise ErroDeNegocio("sessao_expirada", "Sua sessão expirou. Entre novamente.",
                            status.HTTP_401_UNAUTHORIZED)

    usuario = await sessao.get(Usuario, registro.usuario_id)
    if usuario is None or usuario.situacao != "ativa":
        raise ErroDeNegocio("sessao_invalida", "Sessão inválida",
                            status.HTTP_401_UNAUTHORIZED)

    if registro.usado_em is None:
        registro.usado_em = agora
    await sessao.flush()

    resultado = await _abrir_sessao(sessao, usuario, familia_id=registro.familia_id,
                                    request=request)
    await auditoria.registrar(
        sessao, "sessao.renovada", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id, request=request,
    )
    await sessao.commit()
    return resultado


async def sair(
    sessao: AsyncSession, bruto: str | None, *, request: Request | None = None
) -> None:
    """Revoga a linhagem do refresh apresentado. Silencioso se não existir."""
    if not bruto:
        return

    registro = await sessao.scalar(
        select(TokenSessao).where(TokenSessao.token_hash == hash_refresh_token(bruto))
    )
    if registro is None:
        return

    await _revogar_familia(sessao, registro.familia_id)
    await auditoria.registrar(
        sessao, "sessao.encerrada", ator_id=registro.usuario_id,
        entidade="usuario", entidade_id=registro.usuario_id, request=request,
    )
    await sessao.commit()


# ===================== Redefinição de senha =====================


async def pedir_redefinicao(
    sessao: AsyncSession, email_informado: str, *,
    disparado_por: uuid.UUID | None = None, request: Request | None = None,
) -> None:
    """
    Dispara o link. **Não revela se a conta existe** — quem chama responde
    sempre a mesma coisa (FA-04 E1).
    """
    usuario = await sessao.scalar(
        select(Usuario).where(Usuario.email == email_informado)
    )
    if usuario is None:
        return

    # Só o último link vale: pedir de novo invalida o anterior.
    await sessao.execute(
        update(TokenRedefinicaoSenha)
        .where(TokenRedefinicaoSenha.usuario_id == usuario.id,
               TokenRedefinicaoSenha.usado_em.is_(None))
        .values(usado_em=_agora())
    )

    bruto = gerar_refresh_token()
    sessao.add(TokenRedefinicaoSenha(
        usuario_id=usuario.id,
        token_hash=hash_refresh_token(bruto),
        expira_em=_agora() + VALIDADE_LINK_SENHA,
        disparado_por=disparado_por,
    ))
    await auditoria.registrar(
        sessao, "senha.redefinicao_disparada",
        ator_id=disparado_por or usuario.id,
        entidade="usuario", entidade_id=usuario.id, request=request,
    )
    await sessao.commit()

    email.enviar_redefinicao_senha(usuario.email, usuario.nome, bruto)


async def redefinir_senha(
    sessao: AsyncSession, bruto: str, nova_senha: str,
    *, request: Request | None = None,
) -> None:
    registro = await sessao.scalar(
        select(TokenRedefinicaoSenha)
        .where(TokenRedefinicaoSenha.token_hash == hash_refresh_token(bruto))
    )
    agora = _agora()

    if registro is None or registro.usado_em is not None or registro.expira_em <= agora:
        raise ErroDeNegocio("token_expirado",
                            "Este link expirou ou já foi usado. Solicite um novo.")

    usuario = await sessao.get(Usuario, registro.usuario_id)
    if usuario is None:
        raise ErroDeNegocio("token_expirado",
                            "Este link expirou ou já foi usado. Solicite um novo.")

    usuario.senha_hash = gerar_hash_senha(nova_senha)
    registro.usado_em = agora

    # RN-38 — quem redefine costuma estar reagindo a suspeita de invasão;
    # deixar a sessão do invasor viva anularia a troca.
    await revogar_todas_as_sessoes(sessao, usuario.id)

    await auditoria.registrar(
        sessao, "senha.redefinida", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id, request=request,
    )
    await sessao.commit()
