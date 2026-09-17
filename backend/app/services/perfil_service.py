"""
Regras de perfil.

O perfil nasce vazio junto com a conta e é preenchido aos poucos. A única
exigência dura é a RN-13: nome completo, instituição e curso antes da primeira
inscrição — sem isso a ONG decidiria a aprovação no escuro e o certificado
sairia com apelido.
"""

from __future__ import annotations

import os
import time
import uuid
from pathlib import Path

from fastapi import Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import PerfilEstudante, PerfilOng, Usuario

TIPOS_DE_IMAGEM = {"image/jpeg", "image/png", "image/webp", "image/gif"}
EXTENSAO_POR_TIPO = {
    "image/jpeg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif",
}

# RN-13 — os três que liberam a primeira inscrição.
CAMPOS_OBRIGATORIOS = ("nome_completo", "instituicao", "curso")

_CAMPOS_ESTUDANTE = (
    "nome_completo", "instituicao", "curso", "sexo", "data_nascimento",
    "telefone", "cidade", "estado", "bairro", "sobre_mim", "linkedin", "foto",
)
_CAMPOS_ONG = (
    "nome_organizacao", "cnpj", "descricao", "telefone", "site", "instagram",
    "endereco", "cidade", "estado", "logo",
)


async def _carregar_perfil(sessao: AsyncSession, usuario: Usuario):
    """Devolve o registro de perfil do papel, criando-o se faltar."""
    if usuario.papel == "estudante":
        perfil = await sessao.get(PerfilEstudante, usuario.id)
        if perfil is None:
            perfil = PerfilEstudante(usuario_id=usuario.id)
            sessao.add(perfil)
            await sessao.flush()
        return perfil
    if usuario.papel == "ong":
        perfil = await sessao.get(PerfilOng, usuario.id)
        if perfil is None:
            perfil = PerfilOng(usuario_id=usuario.id)
            sessao.add(perfil)
            await sessao.flush()
        return perfil
    return None  # superadmin não tem perfil de domínio


def _camposFaltantes(perfil: PerfilEstudante | None) -> list[str]:
    if perfil is None:
        return list(CAMPOS_OBRIGATORIOS)
    return [c for c in CAMPOS_OBRIGATORIOS
            if not (getattr(perfil, c, None) or "").strip()]


def _serializar(perfil, campos: tuple[str, ...]) -> dict:
    saida = {}
    for campo in campos:
        valor = getattr(perfil, campo, None)
        # A data sai em ISO; o resto vai como está.
        saida[campo] = valor.isoformat() if hasattr(valor, "isoformat") else valor
    return saida


async def obter(sessao: AsyncSession, usuario: Usuario) -> dict:
    perfil = await _carregar_perfil(sessao, usuario)

    corpo: dict = {
        "id": str(usuario.id),
        "nome": usuario.nome,
        "email": usuario.email,
        "papel": usuario.papel,
        "perfil": {},
    }

    if usuario.papel == "estudante":
        corpo["perfil"] = _serializar(perfil, _CAMPOS_ESTUDANTE)
        faltantes = _camposFaltantes(perfil)
        corpo["perfilCompleto"] = not faltantes
        corpo["camposFaltantes"] = faltantes
    elif usuario.papel == "ong":
        corpo["perfil"] = _serializar(perfil, _CAMPOS_ONG)
        corpo["perfil"]["verificada"] = perfil.verificada_em is not None

    return corpo


async def atualizar(
    sessao: AsyncSession, usuario: Usuario, dados: dict, nome: str | None,
    *, request: Request | None = None,
) -> dict:
    if usuario.papel not in ("estudante", "ong"):
        raise ErroDeNegocio("acesso_negado",
                            "Esta conta não possui perfil editável",
                            status.HTTP_403_FORBIDDEN)

    perfil = await _carregar_perfil(sessao, usuario)
    campos = _CAMPOS_ESTUDANTE if usuario.papel == "estudante" else _CAMPOS_ONG

    antes: dict = {}
    depois: dict = {}

    if nome is not None and nome != usuario.nome:
        antes["nome"], depois["nome"] = usuario.nome, nome
        usuario.nome = nome

    # `exclude_unset` no router garante que só chega o que o cliente enviou:
    # campo ausente é "não mexa", campo nulo é "apague".
    for campo, valor in dados.items():
        if campo not in campos:
            continue
        atual = getattr(perfil, campo, None)
        if atual != valor:
            antes[campo] = atual.isoformat() if hasattr(atual, "isoformat") else atual
            depois[campo] = valor.isoformat() if hasattr(valor, "isoformat") else valor
            setattr(perfil, campo, valor)

    if depois:
        await auditoria.registrar(
            sessao, "perfil.atualizado", ator_id=usuario.id, ator_papel=usuario.papel,
            entidade="usuario", entidade_id=usuario.id,
            antes=antes, depois=depois, request=request,
        )

    await sessao.commit()
    await sessao.refresh(usuario)
    return await obter(sessao, usuario)


# ===================== Foto =====================


def _apagar_arquivo(caminho: str | None) -> None:
    """Falha ao limpar arquivo antigo não pode derrubar a operação."""
    if not caminho:
        return
    try:
        # O banco guarda o caminho público; o arquivo mora em `upload_dir`.
        alvo = Path(config.upload_dir) / Path(caminho).name
        if alvo.is_file():
            os.remove(alvo)
    except OSError:
        pass


async def salvar_foto(
    sessao: AsyncSession, usuario: Usuario, arquivo: UploadFile,
    *, request: Request | None = None,
) -> dict:
    if arquivo.content_type not in TIPOS_DE_IMAGEM:
        raise ErroDeNegocio("arquivo_invalido",
                            "Envie uma imagem (JPG, PNG, WebP ou GIF)")

    conteudo = await arquivo.read()
    if len(conteudo) > config.upload_max_bytes:
        limite = config.upload_max_bytes // (1024 * 1024)
        raise ErroDeNegocio("arquivo_muito_grande",
                            f"Arquivo muito grande (máximo {limite} MB)")
    if not conteudo:
        raise ErroDeNegocio("arquivo_invalido", "O arquivo enviado está vazio")

    perfil = await _carregar_perfil(sessao, usuario)
    if perfil is None:
        raise ErroDeNegocio("acesso_negado",
                            "Esta conta não possui perfil editável",
                            status.HTTP_403_FORBIDDEN)

    campo = "foto" if usuario.papel == "estudante" else "logo"

    pasta = Path(config.upload_dir)
    pasta.mkdir(parents=True, exist_ok=True)
    extensao = EXTENSAO_POR_TIPO.get(arquivo.content_type, ".jpg")
    nome_arquivo = f"{usuario.id}-{int(time.time() * 1000)}{extensao}"
    (pasta / nome_arquivo).write_bytes(conteudo)

    _apagar_arquivo(getattr(perfil, campo, None))
    # Caminho público (é assim que a API serve, em /uploads), não o do disco:
    # em produção a pasta fica num volume com caminho absoluto.
    caminho = f"uploads/{nome_arquivo}"
    setattr(perfil, campo, caminho)

    await auditoria.registrar(
        sessao, "perfil.atualizado", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id,
        depois={campo: caminho}, request=request,
    )
    await sessao.commit()
    return await obter(sessao, usuario)


async def remover_foto(
    sessao: AsyncSession, usuario: Usuario, *, request: Request | None = None
) -> dict:
    perfil = await _carregar_perfil(sessao, usuario)
    if perfil is None:
        raise ErroDeNegocio("acesso_negado",
                            "Esta conta não possui perfil editável",
                            status.HTTP_403_FORBIDDEN)

    campo = "foto" if usuario.papel == "estudante" else "logo"
    atual = getattr(perfil, campo, None)
    if atual:
        _apagar_arquivo(atual)
        setattr(perfil, campo, None)
        await auditoria.registrar(
            sessao, "perfil.atualizado", ator_id=usuario.id, ator_papel=usuario.papel,
            entidade="usuario", entidade_id=usuario.id,
            antes={campo: atual}, depois={campo: None}, request=request,
        )
        await sessao.commit()

    return await obter(sessao, usuario)


# ===================== Perfil público =====================


async def obter_publico(sessao: AsyncSession, usuario_id: uuid.UUID) -> dict:
    """
    Versão reduzida, visível a qualquer autenticado.

    Só o que o dono espera que seja público: telefone, endereço e e-mail ficam
    de fora do perfil de estudante.
    """
    usuario = await sessao.get(Usuario, usuario_id)
    if usuario is None or usuario.situacao != "ativa":
        raise ErroDeNegocio("nao_encontrado", "Perfil não encontrado",
                            status.HTTP_404_NOT_FOUND)

    if usuario.papel == "estudante":
        perfil = await sessao.get(PerfilEstudante, usuario.id)
        return {
            "id": str(usuario.id),
            "nome": (perfil.nome_completo if perfil else None) or usuario.nome,
            "papel": usuario.papel,
            "perfil": {
                "instituicao": perfil.instituicao if perfil else None,
                "curso": perfil.curso if perfil else None,
                "cidade": perfil.cidade if perfil else None,
                "estado": perfil.estado if perfil else None,
                "sobre_mim": perfil.sobre_mim if perfil else None,
                "linkedin": perfil.linkedin if perfil else None,
                "foto": perfil.foto if perfil else None,
            },
        }

    if usuario.papel == "ong":
        perfil = await sessao.get(PerfilOng, usuario.id)
        return {
            "id": str(usuario.id),
            "nome": (perfil.nome_organizacao if perfil else None) or usuario.nome,
            "papel": usuario.papel,
            "perfil": {
                "descricao": perfil.descricao if perfil else None,
                "cidade": perfil.cidade if perfil else None,
                "estado": perfil.estado if perfil else None,
                "endereco": perfil.endereco if perfil else None,
                "site": perfil.site if perfil else None,
                "instagram": perfil.instagram if perfil else None,
                "telefone": perfil.telefone if perfil else None,
                "logo": perfil.logo if perfil else None,
                "verificada": bool(perfil and perfil.verificada_em),
            },
        }

    # Conta administrativa não tem perfil público.
    raise ErroDeNegocio("nao_encontrado", "Perfil não encontrado",
                        status.HTTP_404_NOT_FOUND)
