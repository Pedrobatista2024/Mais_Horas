"""
Serialização das entidades para o formato que o frontend já espera.

O backend Node expunha o `id` como `"_id"` e as colunas em camelCase (aliases no
próprio SQL). O frontend depende disso, então a tradução acontece aqui, num só
lugar, em vez de espalhada pelos routers.
"""

from __future__ import annotations

from typing import Any

from app.db.models import Activity, Certificate, Participation, User


def user_ref(user: User) -> dict[str, Any]:
    """Referência enxuta de usuário, como o `jsonb_build_object` fazia."""
    return {"_id": user.id, "name": user.name, "email": user.email}


def user_session(user: User) -> dict[str, Any]:
    """Usuário devolvido no login/registro — sem a senha, obviamente."""
    return {
        "_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


def user_full(user: User) -> dict[str, Any]:
    """Perfil completo do próprio usuário."""
    return {
        "_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "studentProfile": user.student_profile or {},
        "organizationProfile": user.organization_profile or {},
        "createdAt": user.created_at,
        "updatedAt": user.updated_at,
    }


def activity(item: Activity) -> dict[str, Any]:
    """Atividade com `createdBy` como UUID puro."""
    return {
        "_id": item.id,
        "title": item.title,
        "description": item.description,
        "date": item.date,
        "startTime": item.start_time,
        "endTime": item.end_time,
        "location": item.location,
        "workloadHours": item.workload_hours,
        "createdBy": item.created_by,
        "minParticipants": item.min_participants,
        "maxParticipants": item.max_participants,
        "status": item.status,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


def activity_with_creator(item: Activity) -> dict[str, Any]:
    """Atividade com `createdBy` expandido em objeto."""
    data = activity(item)
    data["createdBy"] = user_ref(item.creator)
    return data


def participation_with_user(item: Participation) -> dict[str, Any]:
    """Participação vista pela ONG — traz o aluno expandido."""
    return {
        "_id": item.id,
        "status": item.status,
        "workloadHours": item.workload_hours,
        "validatedBy": item.validated_by,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
        "user": user_ref(item.user),
        "activity": item.activity_id,
    }


def participation_with_activity(item: Participation) -> dict[str, Any]:
    """Participação vista pelo aluno — traz a atividade expandida."""
    return {
        "_id": item.id,
        "status": item.status,
        "workloadHours": item.workload_hours,
        "validatedBy": item.validated_by,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
        "user": item.user_id,
        "activity": {
            "_id": item.activity.id,
            "title": item.activity.title,
            "date": item.activity.date,
            "location": item.activity.location,
            "workloadHours": item.activity.workload_hours,
        },
    }


def participation(item: Participation) -> dict[str, Any]:
    """Participação crua, sem joins."""
    return {
        "_id": item.id,
        "activity": item.activity_id,
        "user": item.user_id,
        "status": item.status,
        "validatedBy": item.validated_by,
        "workloadHours": item.workload_hours,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


def certificate_populated(item: Certificate) -> dict[str, Any]:
    """Certificado completo — usado na verificação pública e no PDF."""
    return {
        "_id": item.id,
        "hours": item.hours,
        "verificationCode": item.verification_code,
        "issuedAt": item.issued_at,
        "createdAt": item.created_at,
        "user": user_ref(item.user),
        "activity": {
            "_id": item.activity.id,
            "title": item.activity.title,
            "date": item.activity.date,
            "location": item.activity.location,
            "workloadHours": item.activity.workload_hours,
            "createdBy": {
                "_id": item.activity.creator.id,
                "name": item.activity.creator.name,
            },
        },
        "participation": item.participation_id,
    }


def certificate_for_user(item: Certificate) -> dict[str, Any]:
    """Certificado na listagem do aluno — atividade resumida."""
    return {
        "_id": item.id,
        "hours": item.hours,
        "verificationCode": item.verification_code,
        "issuedAt": item.issued_at,
        "createdAt": item.created_at,
        "user": item.user_id,
        "activity": {
            "_id": item.activity.id,
            "title": item.activity.title,
            "date": item.activity.date,
            "location": item.activity.location,
        },
    }


def certificate(item: Certificate) -> dict[str, Any]:
    """Certificado cru, sem joins."""
    return {
        "_id": item.id,
        "user": item.user_id,
        "activity": item.activity_id,
        "participation": item.participation_id,
        "hours": item.hours,
        "verificationCode": item.verification_code,
        "issuedAt": item.issued_at,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }
