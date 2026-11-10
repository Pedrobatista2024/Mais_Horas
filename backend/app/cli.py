"""
Comandos operacionais executados no servidor.

Existe para o que não pode ter tela: gerar a chave de assinatura, criar o
primeiro administrador (RN-27) e limpar os dados de demonstração. Quem não tem
acesso ao servidor não vira admin nem apaga nada.

Uso:
    python -m app.cli gerar-chave
    python -m app.cli gerar-segredos
    python -m app.cli criar-admin
    python -m app.cli remover-demonstracao [--confirmar]
"""

from __future__ import annotations

import asyncio
import getpass
import secrets
import sys


def _gerar_chave() -> None:
    from app.core.security import gerar_par_de_chaves

    privada, publica = gerar_par_de_chaves()
    print("Chave Ed25519 gerada.\n")
    print("Coloque no .env (NUNCA versione esta linha):\n")
    print(f"CHAVE_ASSINATURA={privada}\n")
    print("Chave pública, esta pode ser divulgada para auditoria:\n")
    print(publica)


def _gerar_segredos() -> None:
    print("Segredos para o .env:\n")
    print(f"JWT_SECRET={secrets.token_urlsafe(64)}")
    print(f"CHECKIN_SECRET={secrets.token_urlsafe(48)}")
    print("\nSão independentes de propósito: comprometer o QR de presença não")
    print("pode comprometer a sessão dos usuários.")


async def _criar_admin_async() -> None:
    from sqlalchemy import select

    from app.core import auditoria
    from app.core.security import gerar_hash_senha
    from app.db.models import Usuario
    from app.db.session import CriarSessao

    email = input("E-mail do administrador: ").strip().lower()
    nome = input("Nome: ").strip()
    # getpass: a senha não aparece na tela nem fica no histórico do terminal.
    senha = getpass.getpass("Senha (mínimo 12 caracteres): ")

    if len(senha) < 12:
        sys.exit("Senha muito curta. O administrador exige ao menos 12 caracteres.")
    if not email or "@" not in email:
        sys.exit("E-mail inválido.")

    async with CriarSessao() as sessao:
        existe = await sessao.scalar(select(Usuario).where(Usuario.email == email))
        if existe:
            sys.exit(f"Já existe conta com o e-mail {email}.")

        novo = Usuario(
            nome=nome or "Administrador",
            email=email,
            senha_hash=gerar_hash_senha(senha),
            papel="superadmin",
        )
        sessao.add(novo)
        await sessao.flush()
        # FS-01 — quem nasce pela linha de comando também fica na trilha, com a
        # origem marcada: não há ator logado para registrar.
        await auditoria.registrar(
            sessao, "admin.criado", entidade="usuario", entidade_id=novo.id,
            depois={"email": email, "origem": "cli"})
        await sessao.commit()

    print(f"\nAdministrador criado: {email}")
    print("Entre pela tela normal de acesso — não há login separado para admin.")


# Marcas dos dados que o simulador do monitoramento cria (docs/monitoramento.md):
# o domínio de toda conta e as faixas de IP reservadas para documentação
# (RFC 5737), que nunca pertencem a uma pessoa de verdade.
DOMINIO_DEMONSTRACAO = "demonstracao.mais-horas.org"
FAIXAS_DEMONSTRACAO = ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")


async def remover_demonstracao(sessao, confirmar: bool) -> dict[str, int]:
    """
    Apaga as contas de demonstração e tudo o que nasceu delas.

    Atividades, inscrições, certificados e avisos saem em cascata com a conta.
    A trilha de auditoria não tem chave estrangeira (de propósito), então as
    linhas dela são apagadas aqui, e só as marcadas: ator ou entidade de
    demonstração, ou IP de uma faixa de documentação. É a única exceção à
    regra de que a trilha não se apaga, e por isso fica fora de qualquer rota
    e deixa o próprio registro.

    Sem `confirmar`, só conta.
    """
    from sqlalchemy import cast, delete, func, or_, select
    from sqlalchemy.dialects.postgresql import CIDR

    from app.core import auditoria
    from app.db.models import (
        Atividade, Certificado, Inscricao, RegistroAuditoria, Usuario,
    )

    usuarios = list(await sessao.scalars(select(Usuario.id).where(
        Usuario.email.like(f"%@{DOMINIO_DEMONSTRACAO}"))))
    atividades = list(await sessao.scalars(select(Atividade.id).where(
        Atividade.ong_id.in_(usuarios))))
    inscricoes = list(await sessao.scalars(select(Inscricao.id).where(or_(
        Inscricao.usuario_id.in_(usuarios),
        Inscricao.atividade_id.in_(atividades)))))
    certificados = list(await sessao.scalars(select(Certificado.id).where(
        Certificado.inscricao_id.in_(inscricoes))))

    da_trilha = or_(
        RegistroAuditoria.ator_id.in_(usuarios),
        RegistroAuditoria.entidade_id.in_(
            usuarios + atividades + inscricoes + certificados),
        *(RegistroAuditoria.ip.op("<<")(cast(faixa, CIDR))
          for faixa in FAIXAS_DEMONSTRACAO),
    )
    contagem = {
        "contas": len(usuarios), "atividades": len(atividades),
        "inscricoes": len(inscricoes), "certificados": len(certificados),
        "linhas_da_trilha": await sessao.scalar(
            select(func.count()).select_from(RegistroAuditoria).where(da_trilha)),
    }
    if not confirmar:
        return contagem

    await sessao.execute(delete(RegistroAuditoria).where(da_trilha))
    await sessao.execute(delete(Usuario).where(Usuario.id.in_(usuarios)))
    await auditoria.registrar(sessao, "sistema.demonstracao_removida",
                              depois={**contagem, "origem": "cli"})
    await sessao.commit()
    return contagem


async def _remover_demonstracao_async(confirmar: bool) -> None:
    from app.db.session import CriarSessao

    async with CriarSessao() as sessao:
        contagem = await remover_demonstracao(sessao, confirmar)

    print(f"Contas de demonstração ({DOMINIO_DEMONSTRACAO}): {contagem['contas']}")
    print(f"Atividades: {contagem['atividades']}  "
          f"Inscrições: {contagem['inscricoes']}  "
          f"Certificados: {contagem['certificados']}")
    print(f"Linhas da trilha de auditoria: {contagem['linhas_da_trilha']}")
    print()
    print("Dados de demonstração apagados." if confirmar else
          "Nada foi apagado. Rode de novo com --confirmar para apagar.")


COMANDOS = {
    "gerar-chave": _gerar_chave,
    "gerar-segredos": _gerar_segredos,
    "criar-admin": lambda: asyncio.run(_criar_admin_async()),
    "remover-demonstracao": lambda: asyncio.run(
        _remover_demonstracao_async("--confirmar" in sys.argv)),
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in COMANDOS:
        print("Comandos disponíveis:")
        for nome in COMANDOS:
            print(f"  python -m app.cli {nome}")
        sys.exit(1)
    COMANDOS[sys.argv[1]]()


if __name__ == "__main__":
    main()
