"""
Regras de usuário: cadastro, autenticação, sessão e perfil.

O fluxo de sessão segue o padrão recomendado para SPA:

- **access token** JWT de vida curta, devolvido no corpo e guardado em memória
  pelo frontend;
- **refresh token** opaco de vida longa, entregue só em cookie httpOnly, gravado
  no banco como hash, e **rotacionado a cada uso**;
- se um refresh token já usado reaparecer, a família inteira é revogada — é o
  sinal clássico de token roubado.
"""

from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    needs_rehash,
    refresh_token_expiry,
    verify_password,
)
from app.db.models import RefreshToken, User
from app.utils import serialize

STUDENT_FIELDS = (
    "fullName", "sex", "phone", "city", "state", "neighborhood",
    "institution", "courseName", "aboutMe", "linkedin", "photoUrl",
)

ORG_FIELDS = (
    "organizationName", "cnpj", "description", "phone", "website", "address", "instagram",
)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Janela em que reapresentar um refresh token já consumido conta como corrida
# benigna, não como roubo.
#
# Sem isso, duas requisições concorrentes do mesmo cliente (duas abas, retry de
# rede, ou o StrictMode do React em dev) derrubariam a sessão de um usuário
# legítimo. O atacante que rouba um token continua sendo pego: ele só teria
# esses poucos segundos, e o uso seguinte dele — ou do dono — cai fora da janela
# e revoga a família toda.
REFRESH_REUSE_GRACE_SECONDS = 15


# ===================== Sessão =====================


async def _issue_session(
    db: AsyncSession,
    user: User,
    *,
    family_id: uuid.UUID | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[str, int, str]:
    """
    Emite access + refresh para o usuário.

    Retorna (access_token, expires_in, refresh_token_em_claro).
    """
    access_token, expires_in = create_access_token(user.id, user.role)

    raw_refresh = generate_refresh_token()
    record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw_refresh),
        family_id=family_id or uuid.uuid4(),
        expires_at=refresh_token_expiry(),
        user_agent=(user_agent or "")[:400] or None,
        ip_address=(ip_address or "")[:64] or None,
    )
    db.add(record)
    await db.commit()

    return access_token, expires_in, raw_refresh


async def _revoke_family(db: AsyncSession, family_id: uuid.UUID) -> None:
    """Revoga todos os refresh tokens de uma mesma linhagem de login."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def register(
    db: AsyncSession,
    data: dict[str, Any],
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    email = data["email"]

    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise AppError("Email já cadastrado", status.HTTP_409_CONFLICT)

    user = User(
        name=data["name"],
        email=email,
        password=hash_password(data["password"]),
        role=data.get("role", "student"),
        student_profile={},
        organization_profile={},
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token, expires_in, raw_refresh = await _issue_session(
        db, user, user_agent=user_agent, ip_address=ip_address
    )
    return {
        "user": serialize.user_session(user),
        "token": token,
        "expiresIn": expires_in,
        "_refresh": raw_refresh,
    }


async def login(
    db: AsyncSession,
    email: str,
    password: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    user = await db.scalar(select(User).where(User.email == email))

    # Mensagem única para email inexistente e senha errada: não entrega ao
    # atacante a informação de quais emails estão cadastrados.
    if user is None or not verify_password(password, user.password):
        raise AppError("Email ou senha incorretos", status.HTTP_400_BAD_REQUEST)

    # Usuário vindo do backend Node ainda tem hash bcrypt — atualiza para Argon2id
    # agora que temos a senha em claro nas mãos.
    if needs_rehash(user.password):
        user.password = hash_password(password)
        await db.commit()

    token, expires_in, raw_refresh = await _issue_session(
        db, user, user_agent=user_agent, ip_address=ip_address
    )
    return {
        "user": serialize.user_session(user),
        "token": token,
        "expiresIn": expires_in,
        "_refresh": raw_refresh,
    }


async def refresh_session(
    db: AsyncSession,
    raw_token: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    """Troca um refresh token válido por um novo par, rotacionando o antigo."""
    token_hash = hash_refresh_token(raw_token)
    record = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))

    if record is None:
        raise AppError("Sessão inválida", status.HTTP_401_UNAUTHORIZED)

    now = datetime.now(timezone.utc)

    # Revogação explícita (logout, ou família derrubada) não renova nunca.
    if record.revoked_at is not None:
        raise AppError("Sessão inválida", status.HTTP_401_UNAUTHORIZED)

    if record.used_at is not None:
        idade = (now - record.used_at).total_seconds()
        if idade > REFRESH_REUSE_GRACE_SECONDS:
            # Token consumido há tempo reaparecendo = provável roubo.
            # Derruba a linhagem inteira, forçando login novo.
            await _revoke_family(db, record.family_id)
            raise AppError("Sessão inválida", status.HTTP_401_UNAUTHORIZED)
        # Dentro da janela de graça é corrida benigna, não ataque: duas abas,
        # retry de rede, ou o StrictMode do React montando o efeito duas vezes.
        # Emite um par novo na mesma família em vez de derrubar a sessão.

    if record.expires_at <= now:
        raise AppError("Sessão expirada", status.HTTP_401_UNAUTHORIZED)

    user = await db.get(User, record.user_id)
    if user is None:
        raise AppError("Usuário não encontrado", status.HTTP_404_NOT_FOUND)

    if record.used_at is None:
        record.used_at = now
    await db.flush()

    token, expires_in, raw_refresh = await _issue_session(
        db, user, family_id=record.family_id, user_agent=user_agent, ip_address=ip_address
    )
    return {
        "user": serialize.user_session(user),
        "token": token,
        "expiresIn": expires_in,
        "_refresh": raw_refresh,
    }


async def logout(db: AsyncSession, raw_token: str | None) -> None:
    """Revoga a linhagem do refresh token apresentado. Silencioso se não existir."""
    if not raw_token:
        return

    record = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_token))
    )
    if record is not None:
        await _revoke_family(db, record.family_id)


# ===================== Perfil =====================


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("Usuário não encontrado", status.HTTP_404_NOT_FOUND)
    return serialize.user_full(user)


def _save_photo(user_id: uuid.UUID, photo: UploadFile, content: bytes) -> str:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(photo.filename or "").suffix or ".jpg"
    filename = f"{user_id}-{int(time.time() * 1000)}{ext}"
    destination = upload_dir / filename
    destination.write_bytes(content)

    return f"{settings.upload_dir}/{filename}"


def _remove_old_photo(old_path: str | None) -> None:
    if not old_path:
        return
    try:
        candidate = Path(old_path)
        if candidate.is_file():
            os.remove(candidate)
    except OSError:
        # Falha ao limpar arquivo antigo não pode derrubar a atualização de perfil.
        pass


async def update_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: dict[str, Any],
    photo: UploadFile | None,
    photo_bytes: bytes | None,
) -> dict[str, Any]:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError("Usuário não encontrado", status.HTTP_404_NOT_FOUND)

    if data.get("name") is not None:
        user.name = data["name"]

    if user.role == "student":
        profile = dict(user.student_profile or {})
        for field in STUDENT_FIELDS:
            if data.get(field) is not None:
                profile[field] = data[field]

        if "birthDate" in data:
            raw = data.get("birthDate")
            if not raw:
                profile["birthDate"] = None
            else:
                parsed = _parse_birth_date(raw)
                if parsed is not None:
                    profile["birthDate"] = parsed

        if photo is not None and photo_bytes is not None:
            _remove_old_photo(profile.get("photo"))
            profile["photo"] = _save_photo(user_id, photo, photo_bytes)

        user.student_profile = profile

    elif user.role == "organization":
        profile = dict(user.organization_profile or {})
        for field in ORG_FIELDS:
            if data.get(field) is not None:
                profile[field] = data[field]

        if photo is not None and photo_bytes is not None:
            _remove_old_photo(profile.get("photo"))
            profile["photo"] = _save_photo(user_id, photo, photo_bytes)

        user.organization_profile = profile

    await db.commit()
    await db.refresh(user)
    return serialize.user_full(user)


def _parse_birth_date(raw: str) -> str | None:
    """Normaliza a data de nascimento para ISO. Ignora valor irreconhecível."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(raw[:26], fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return None


async def get_org_public(db: AsyncSession, org_id: uuid.UUID) -> dict[str, Any]:
    user = await db.get(User, org_id)
    if user is None:
        raise AppError("ONG não encontrada", status.HTTP_404_NOT_FOUND)
    if user.role != "organization":
        raise AppError("Usuário não é uma ONG", status.HTTP_400_BAD_REQUEST)

    profile = user.organization_profile or {}
    return {
        "_id": user.id,
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "organizationProfile": {
            "organizationName": profile.get("organizationName", ""),
            "description": profile.get("description", ""),
            "phone": profile.get("phone", ""),
            "address": profile.get("address", ""),
            "website": profile.get("website", ""),
            "instagram": profile.get("instagram", ""),
            "photo": profile.get("photo", ""),
        },
    }


async def get_student_public(db: AsyncSession, student_id: uuid.UUID) -> dict[str, Any]:
    user = await db.get(User, student_id)
    if user is None:
        raise AppError("Aluno não encontrado", status.HTTP_404_NOT_FOUND)
    if user.role != "student":
        raise AppError("Usuário não é um aluno", status.HTTP_400_BAD_REQUEST)

    profile = user.student_profile or {}
    return {
        "_id": user.id,
        "role": user.role,
        "name": profile.get("fullName") or user.name or "",
        "email": user.email,
        "studentProfile": {
            "fullName": profile.get("fullName", ""),
            "sex": profile.get("sex", ""),
            "birthDate": profile.get("birthDate"),
            "city": profile.get("city", ""),
            "state": profile.get("state", ""),
            "neighborhood": profile.get("neighborhood", ""),
            "institution": profile.get("institution", ""),
            "courseName": profile.get("courseName", ""),
            "aboutMe": profile.get("aboutMe", ""),
            "linkedin": profile.get("linkedin", ""),
            "photoUrl": profile.get("photoUrl", ""),
            "photo": profile.get("photo", ""),
        },
    }
