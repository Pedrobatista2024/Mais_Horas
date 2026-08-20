"""
Hash de senha e emissão de tokens.

Senhas: Argon2id para hashes novos, bcrypt aceito só para verificar os hashes
antigos vindos do backend Node (bcryptjs). No primeiro login bem-sucedido de um
usuário legado, a senha é re-hasheada em Argon2id automaticamente.

Tokens: access token JWT curto (stateless) + refresh token opaco e revogável,
guardado no banco apenas como hash SHA-256.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import settings

_ph = PasswordHasher()

_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


# ===================== Senhas =====================


def hash_password(password: str) -> str:
    """Gera hash Argon2id da senha."""
    return _ph.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Verifica a senha contra o hash guardado, aceitando Argon2id (novo) e
    bcrypt (legado, gerado pelo backend Node).
    """
    if not stored_hash:
        return False

    if stored_hash.startswith(_BCRYPT_PREFIXES):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
        except (ValueError, TypeError):
            return False

    try:
        return _ph.verify(stored_hash, password)
    except (VerifyMismatchError, InvalidHashError, ValueError):
        return False


def needs_rehash(stored_hash: str) -> bool:
    """
    True quando o hash guardado deve ser regravado: hash bcrypt legado, ou
    Argon2 com parâmetros defasados em relação aos atuais.
    """
    if not stored_hash:
        return False
    if stored_hash.startswith(_BCRYPT_PREFIXES):
        return True
    try:
        return _ph.check_needs_rehash(stored_hash)
    except (InvalidHashError, ValueError):
        return False


# ===================== Access token (JWT) =====================


def create_access_token(user_id: uuid.UUID | str, role: str) -> tuple[str, int]:
    """
    Emite o access token. Retorna (token, segundos_ate_expirar).

    O payload carrega o papel do usuário para que a checagem de role não
    precise ir ao banco em toda requisição.
    """
    now = datetime.now(timezone.utc)
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = now + expires_delta

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": expire,
        "jti": secrets.token_urlsafe(16),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Valida assinatura e expiração. Retorna o payload, ou None se inválido."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError:
        return None

    if payload.get("type") != "access":
        return None
    if not payload.get("sub"):
        return None
    return payload


# ===================== Refresh token (opaco) =====================


def generate_refresh_token() -> str:
    """
    Gera o refresh token em claro — é entregue ao cliente e nunca guardado
    assim no banco.
    """
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """
    Hash determinístico do refresh token, para permitir busca por igualdade.

    SHA-256 basta aqui (diferente de senha): o token tem 384 bits de entropia
    aleatória, então não há o que atacar por dicionário ou força bruta.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
