"""
Rotas de usuário e autenticação — `/api/users`.

O refresh token nunca aparece no corpo da resposta: ele é gravado em cookie
httpOnly, o que o mantém fora do alcance de qualquer script da página. Por isso
as rotas de sessão respondem com `Response` e escrevem o cookie na mão.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.deps import CurrentUser, DbSession
from app.core.errors import AppError
from app.core.rate_limit import auth_rate_limit
from app.schemas.user import LoginIn, RegisterIn, UpdateProfileIn
from app.services import user_service

router = APIRouter(prefix="/users", tags=["usuarios"])

REFRESH_COOKIE = "mh_refresh"
# Restringe o envio do cookie às rotas de sessão — ele não precisa acompanhar
# as demais chamadas da API.
REFRESH_COOKIE_PATH = "/api/users"


def _session_response(result: dict[str, Any], message: str, status_code: int = 200) -> Response:
    """Monta a resposta de sessão e planta o refresh token no cookie."""
    raw_refresh = result.pop("_refresh")

    response = JSONResponse(
        status_code=status_code,
        content={
            "message": message,
            "user": {**result["user"], "_id": str(result["user"]["_id"])},
            "token": result["token"],
            "expiresIn": result["expiresIn"],
        },
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_refresh,
        max_age=settings.refresh_token_expire_days * 24 * 60 * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path=REFRESH_COOKIE_PATH,
    )
    return response


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


def _client_info(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    return user_agent, ip


# ===================== Sessão =====================


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limit)],
)
async def register(request: Request, payload: RegisterIn, db: DbSession) -> Response:
    user_agent, ip = _client_info(request)
    result = await user_service.register(
        db,
        payload.model_dump(),
        user_agent=user_agent,
        ip_address=ip,
    )
    return _session_response(result, "Usuário criado com sucesso", status.HTTP_201_CREATED)


@router.post("/login", dependencies=[Depends(auth_rate_limit)])
async def login(request: Request, payload: LoginIn, db: DbSession) -> Response:
    user_agent, ip = _client_info(request)
    result = await user_service.login(
        db,
        payload.email,
        payload.password,
        user_agent=user_agent,
        ip_address=ip,
    )
    return _session_response(result, "Login realizado")


@router.post("/refresh")
async def refresh(request: Request, db: DbSession) -> Response:
    """Troca o refresh token do cookie por um novo par de tokens."""
    raw_token = request.cookies.get(REFRESH_COOKIE)
    if not raw_token:
        raise AppError("Sessão inválida", status.HTTP_401_UNAUTHORIZED)

    user_agent, ip = _client_info(request)
    result = await user_service.refresh_session(
        db, raw_token, user_agent=user_agent, ip_address=ip
    )
    return _session_response(result, "Sessão renovada")


@router.post("/logout")
async def logout(request: Request, db: DbSession) -> Response:
    await user_service.logout(db, request.cookies.get(REFRESH_COOKIE))
    response = JSONResponse(content={"message": "Sessão encerrada"})
    _clear_refresh_cookie(response)
    return response


# ===================== Perfil =====================


@router.get("/profile")
async def get_profile(user: CurrentUser, db: DbSession) -> dict[str, Any]:
    profile = await user_service.get_profile(db, user.id)
    return {"message": "Perfil carregado com sucesso", "user": profile}


@router.put("/profile")
async def update_profile(
    request: Request,
    user: CurrentUser,
    db: DbSession,
    photo: Annotated[UploadFile | None, File()] = None,
) -> dict[str, Any]:
    """
    Aceita JSON puro ou multipart com o campo `photo`.

    O corpo é lido cru e validado pelo `UpdateProfileIn` porque o formulário
    pode trazer campos extras — o schema zod original também era permissivo.
    """
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        raw = {k: v for k, v in form.items() if not isinstance(v, UploadFile)}
    else:
        try:
            raw = await request.json()
        except Exception:
            raw = {}
        if not isinstance(raw, dict):
            raw = {}

    data = UpdateProfileIn.model_validate(raw).model_dump(exclude_unset=True)

    photo_bytes: bytes | None = None
    if photo is not None and photo.filename:
        if photo.content_type not in user_service.ALLOWED_IMAGE_TYPES:
            raise AppError("Arquivo não é uma imagem", status.HTTP_400_BAD_REQUEST)
        photo_bytes = await photo.read()
        if len(photo_bytes) > settings.max_upload_bytes:
            raise AppError("Arquivo muito grande (máx 2MB)", status.HTTP_400_BAD_REQUEST)
    else:
        photo = None

    profile = await user_service.update_profile(db, user.id, data, photo, photo_bytes)
    return {"message": "Perfil atualizado com sucesso", "user": profile}


# ===================== Perfis públicos =====================


@router.get("/org/{org_id}/public")
async def org_public_profile(
    org_id: uuid.UUID, _: CurrentUser, db: DbSession
) -> dict[str, Any]:
    profile = await user_service.get_org_public(db, org_id)
    return {"message": "Perfil público da ONG carregado com sucesso", "user": profile}


@router.get("/student/{student_id}/public")
async def student_public_profile(
    student_id: uuid.UUID, _: CurrentUser, db: DbSession
) -> dict[str, Any]:
    profile = await user_service.get_student_public(db, student_id)
    return {"message": "Perfil público do aluno carregado com sucesso", "user": profile}
