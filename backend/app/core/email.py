"""
Envio de e-mail.

Na v1 o modo padrão é `console` (D39): a mensagem é escrita no terminal em vez
de enviada. Isso destrava a recuperação de senha sem depender de provedor
externo, e mantém a regra de negócio indiferente a qual serviço será usado
depois — trocar de provedor é implementar outra função aqui.
"""

from __future__ import annotations

import logging

from app.core.config import config

log = logging.getLogger("mais_horas.email")


def _console(destinatario: str, assunto: str, corpo: str) -> None:
    print("\n" + "=" * 68)
    print(f"[e-mail] Para:    {destinatario}")
    print(f"[e-mail] Assunto: {assunto}")
    print("-" * 68)
    print(corpo.strip())
    print("=" * 68 + "\n", flush=True)


def enviar(destinatario: str, assunto: str, corpo: str) -> None:
    if config.email_modo == "console":
        _console(destinatario, assunto, corpo)
        return
    # Provedor real entra aqui no deploy, sem tocar em quem chama.
    log.warning("EMAIL_MODO=%r não implementado; mensagem não enviada para %s",
                config.email_modo, destinatario)


def enviar_redefinicao_senha(destinatario: str, nome: str, token: str) -> None:
    link = f"{config.web_url.rstrip('/')}/redefinir-senha?token={token}"
    enviar(
        destinatario,
        "Redefinição de senha — Mais Horas",
        f"""
Olá, {nome}.

Recebemos um pedido para redefinir a senha da sua conta no Mais Horas.
Acesse o link abaixo para escolher uma nova senha:

    {link}

O link vale por 1 hora e só pode ser usado uma vez.

Se não foi você quem pediu, ignore esta mensagem: sua senha continua a mesma.
""",
    )
