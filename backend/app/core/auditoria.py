"""
Trilha de auditoria (RN-33).

Somente inserção: não existe função aqui para editar nem apagar registro, e
nenhum outro módulo deve escrever nessa tabela por outro caminho. A ausência é
a garantia.

A escrita começa na Fatia 1 e não na 8, onde o console aparece: adiar
significaria voltar em todas as fatias depois enfiando registro.
"""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import RegistroAuditoria


# Catálogo canônico de ações — docs/contrato-api.md, seção 13.
# Nome inventado na hora torna a busca inútil, então a lista é fechada.
ACOES = {
    # Sessão e conta
    "conta.criada", "sessao.iniciada", "sessao.falha", "sessao.renovada",
    "sessao.encerrada", "sessao.reuso_detectado", "sessoes.revogadas",
    "senha.redefinicao_disparada", "senha.redefinida", "perfil.atualizado",
    "conta.suspensa", "conta.reativada",
    # Atividade
    "atividade.rascunho_criado", "atividade.publicada", "atividade.editada",
    "atividade.editada_por_admin", "atividade.cancelada", "atividade.excluida",
    "atividade.finalizada", "atividade.validacao_forcada",
    # Inscrição e presença
    "inscricao.criada", "inscricao.aprovada", "inscricao.recusada",
    "inscricao.cancelada", "checkin.painel_aberto", "checkin.registrado",
    "checkin.token_invalido", "presenca.validada",
    # Certificado
    "certificado.emitido", "certificado.revogado",
    "certificado.revogacao_revertida", "integridade.verificada",
    # Administração
    "admin.criado", "admin.entrou_como", "admin.saiu_do_modo",
    "admin.navegou_como", "auditoria.consultada", "ong.verificada",
    "ong.verificacao_removida",
}


def contexto(request: Request | None) -> tuple[str | None, str | None]:
    """IP e user agent da requisição, quando houver."""
    if request is None:
        return None, None
    encaminhado = request.headers.get("x-forwarded-for")
    ip = (encaminhado.split(",")[0].strip() if encaminhado
          else (request.client.host if request.client else None))
    return ip, request.headers.get("user-agent")


async def registrar(
    sessao: AsyncSession,
    acao: str,
    *,
    ator_id: uuid.UUID | None = None,
    ator_papel: str | None = None,
    em_nome_de_id: uuid.UUID | None = None,
    entidade: str | None = None,
    entidade_id: uuid.UUID | None = None,
    antes: dict[str, Any] | None = None,
    depois: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """
    Acrescenta uma linha à trilha.

    Não faz commit: participa da transação de quem chamou. Se a operação for
    revertida, o registro some junto — auditar algo que não aconteceu seria
    pior que não auditar.
    """
    if acao not in ACOES:
        raise ValueError(
            f"Ação '{acao}' fora do catálogo. Acrescente em app/core/auditoria.py "
            f"e em docs/contrato-api.md antes de usar."
        )

    ip, user_agent = contexto(request)
    sessao.add(RegistroAuditoria(
        ator_id=ator_id,
        ator_papel=ator_papel,
        em_nome_de_id=em_nome_de_id,
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        antes=antes,
        depois=depois,
        ip=ip,
        user_agent=user_agent,
    ))
