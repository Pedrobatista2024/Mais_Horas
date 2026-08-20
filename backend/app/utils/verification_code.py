"""Código de verificação do certificado — o que vai dentro do QR Code."""

from __future__ import annotations

import secrets


def generate_verification_code() -> str:
    """
    16 caracteres hex (8 bytes aleatórios), igual ao formato que o backend Node
    gerava — os códigos já emitidos continuam válidos.
    """
    return secrets.token_hex(8)
