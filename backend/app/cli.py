"""
Comandos operacionais executados no servidor.

Existe para o que não pode ter tela: gerar a chave de assinatura e criar o
primeiro administrador (RN-27). Quem não tem acesso ao servidor não vira admin.

Uso:
    python -m app.cli gerar-chave
    python -m app.cli gerar-segredos
    python -m app.cli criar-admin
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


COMANDOS = {
    "gerar-chave": _gerar_chave,
    "gerar-segredos": _gerar_segredos,
    "criar-admin": lambda: asyncio.run(_criar_admin_async()),
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
