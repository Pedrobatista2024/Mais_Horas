"""
Teste de fumaça ponta a ponta da API.

Exercita o fluxo completo: cadastro, login, rotação de refresh, criação de
atividade, inscrição, validação de presença, emissão de certificado e
verificação pública por código. Também confere as travas de papel e sessão.

Uso: python smoke_test.py   (exige o Postgres do docker compose no ar)
"""

from __future__ import annotations

import sys
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services import user_service

PASSOU = 0
FALHOU = 0


def check(label: str, condition: bool, extra: str = "") -> None:
    global PASSOU, FALHOU
    if condition:
        PASSOU += 1
        print(f"  OK     {label}")
    else:
        FALHOU += 1
        print(f"  FALHOU {label} {extra}")


def secao(titulo: str) -> None:
    print(f"\n=== {titulo} ===")


def set_refresh(client: TestClient, valor: str) -> None:
    """
    Troca o cookie de refresh.

    Precisa limpar antes: o httpx acumula cookies de mesmo nome em vez de
    substituir, e depois recusa a leitura com CookieConflict.
    """
    client.cookies.clear()
    client.cookies.set("mh_refresh", valor, domain="testserver.local", path="/api/users")


def get_refresh(client: TestClient) -> str:
    return client.cookies.get("mh_refresh", domain="testserver.local", path="/api/users")


def main() -> int:
    sufixo = uuid.uuid4().hex[:8]
    email_aluno = f"aluno-{sufixo}@teste.com"
    email_ong = f"ong-{sufixo}@teste.com"
    senha = "senha123"

    with TestClient(app) as client:
        secao("Serviço")
        r = client.get("/health")
        check("GET /health responde 200", r.status_code == 200)
        check("health diz ok", r.json().get("status") == "ok")

        secao("Cadastro")
        r = client.post(
            "/api/users/register",
            json={"name": "Aluno Teste", "email": email_aluno, "password": senha},
        )
        check("registro de aluno cria 201", r.status_code == 201, r.text[:200])
        body = r.json()
        check("resposta traz token", bool(body.get("token")))
        check("resposta traz expiresIn", body.get("expiresIn") == 900)
        check("usuario tem _id", "_id" in body.get("user", {}))
        check("role default e student", body["user"]["role"] == "student")
        check("senha nao vaza na resposta", "password" not in body.get("user", {}))
        check(
            "refresh token vai em cookie httpOnly",
            "mh_refresh" in r.cookies or "mh_refresh" in client.cookies,
        )
        check("refresh token NAO vai no corpo", "refresh" not in r.text.lower())
        token_aluno = body["token"]
        id_aluno = body["user"]["_id"]

        r = client.post(
            "/api/users/register",
            json={
                "name": "ONG Teste",
                "email": email_ong,
                "password": senha,
                "role": "organization",
            },
        )
        check("registro de ONG cria 201", r.status_code == 201, r.text[:200])
        token_ong = r.json()["token"]

        r = client.post(
            "/api/users/register",
            json={"name": "Duplicado", "email": email_aluno, "password": senha},
        )
        check("email duplicado rejeitado com 409", r.status_code == 409, r.text[:120])

        r = client.post(
            "/api/users/register",
            json={"name": "X", "email": "invalido", "password": "123"},
        )
        check("registro invalido rejeitado com 400", r.status_code == 400)
        check("erro traz lista de details", isinstance(r.json().get("details"), list))

        secao("Login")
        r = client.post("/api/users/login", json={"email": email_aluno, "password": senha})
        check("login correto responde 200", r.status_code == 200, r.text[:200])
        token_aluno = r.json()["token"]

        r = client.post(
            "/api/users/login", json={"email": email_aluno, "password": "errada"}
        )
        check("senha errada rejeitada com 400", r.status_code == 400)
        check(
            "mensagem nao revela se o email existe",
            "senha incorreta" not in r.json().get("message", "").lower(),
            r.json().get("message", ""),
        )

        secao("Sessão: rotação de refresh")
        r = client.post("/api/users/login", json={"email": email_aluno, "password": senha})
        refresh_antigo = get_refresh(client)
        check("login planta cookie de refresh", bool(refresh_antigo))

        r = client.post("/api/users/refresh")
        check("refresh troca por novo token", r.status_code == 200, r.text[:200])
        refresh_novo = get_refresh(client)
        check("refresh token foi rotacionado", refresh_novo != refresh_antigo)
        check("refresh devolve access novo", bool(r.json().get("token")))

        secao("Sessão: corrida benigna dentro da janela de graça")
        # Duas abas, retry de rede ou o StrictMode do React reapresentam o mesmo
        # cookie em sequência. Isso NÃO pode derrubar a sessão.
        set_refresh(client, refresh_antigo)
        r = client.post("/api/users/refresh")
        check("reuso imediato e tolerado", r.status_code == 200, r.text[:120])

        set_refresh(client, refresh_novo)
        r = client.post("/api/users/refresh")
        check("sessao continua viva apos a corrida", r.status_code == 200, r.text[:120])
        refresh_vivo = get_refresh(client)

        secao("Sessão: detecção de roubo fora da janela")
        # Zera a graça para simular o token reaparecendo muito depois — aí sim
        # é roubo, e a família inteira tem que cair.
        graca_original = user_service.REFRESH_REUSE_GRACE_SECONDS
        user_service.REFRESH_REUSE_GRACE_SECONDS = -1
        try:
            set_refresh(client, refresh_antigo)
            r = client.post("/api/users/refresh")
            check("token antigo fora da janela e rejeitado", r.status_code == 401, r.text[:120])

            set_refresh(client, refresh_vivo)
            r = client.post("/api/users/refresh")
            check(
                "familia inteira revogada apos roubo (401)",
                r.status_code == 401,
                r.text[:120],
            )
        finally:
            user_service.REFRESH_REUSE_GRACE_SECONDS = graca_original

        secao("Autenticação e papéis")
        r = client.get("/api/users/profile")
        check("sem token responde 401", r.status_code == 401)

        r = client.get("/api/users/profile", headers={"Authorization": "Bearer lixo"})
        check("token invalido responde 401", r.status_code == 401)

        r = client.get(
            "/api/users/profile", headers={"Authorization": f"Bearer {token_aluno}"}
        )
        check("token valido carrega perfil", r.status_code == 200, r.text[:200])
        check("perfil traz studentProfile", "studentProfile" in r.json()["user"])

        auth_aluno = {"Authorization": f"Bearer {token_aluno}"}
        auth_ong = {"Authorization": f"Bearer {token_ong}"}

        r = client.post(
            "/api/activities",
            headers=auth_aluno,
            json={
                "title": "Tentativa",
                "description": "aluno nao pode criar",
                "location": "Praca",
                "date": "2030-01-01",
                "startTime": "08:00",
                "endTime": "12:00",
                "workloadHours": 4,
            },
        )
        check("aluno criando atividade recebe 403", r.status_code == 403, r.text[:120])

        secao("Atividades")
        r = client.post(
            "/api/activities",
            headers=auth_ong,
            json={
                "title": "Mutirao de limpeza",
                "description": "Limpeza da praca central",
                "location": "Praca Central",
                "date": "2030-06-15",
                "startTime": "08:00",
                "endTime": "12:00",
                "workloadHours": 4,
                "maxParticipants": 10,
            },
        )
        check("ONG cria atividade com 201", r.status_code == 201, r.text[:200])
        atividade = r.json()["activity"]
        id_atividade = atividade["_id"]
        check("titulo capitalizado", atividade["title"] == "Mutirao de limpeza")
        check("status nasce active", atividade["status"] == "active")

        r = client.post(
            "/api/activities",
            headers=auth_ong,
            json={
                "title": "No passado",
                "description": "data invalida",
                "location": "Praca",
                "date": "2020-01-01",
                "startTime": "08:00",
                "endTime": "12:00",
                "workloadHours": 4,
            },
        )
        check("data no passado rejeitada com 400", r.status_code == 400, r.text[:120])

        r = client.get("/api/activities")
        check("listagem publica funciona sem token", r.status_code == 200)
        check("atividade aparece na lista", any(a["_id"] == id_atividade for a in r.json()))
        criador = next(a for a in r.json() if a["_id"] == id_atividade)["createdBy"]
        check("createdBy vem expandido com _id", isinstance(criador, dict) and "_id" in criador)

        r = client.get("/api/activities/my", headers=auth_ong)
        check("ONG lista as proprias atividades", r.status_code == 200 and len(r.json()) >= 1)

        secao("Inscrição e presença")
        r = client.post(f"/api/activities/{id_atividade}/join", headers=auth_aluno)
        check("aluno se inscreve", r.status_code == 200, r.text[:200])

        r = client.post(f"/api/activities/{id_atividade}/join", headers=auth_aluno)
        check("inscricao duplicada rejeitada", r.status_code == 400, r.text[:120])

        r = client.get(f"/api/activities/{id_atividade}", headers=auth_aluno)
        check("detalhes trazem participants", "participants" in r.json())
        check("participante aparece", len(r.json()["participants"]) == 1)

        r = client.post(f"/api/activities/{id_atividade}/finish", headers=auth_ong)
        check(
            "nao finaliza com presenca pendente",
            r.status_code == 400,
            r.text[:120],
        )

        r = client.patch(
            f"/api/activities/{id_atividade}/attendance",
            headers=auth_ong,
            json={"userId": id_aluno, "status": "present"},
        )
        check("ONG marca presenca", r.status_code == 200, r.text[:200])

        secao("Certificado")
        r = client.post(f"/api/activities/{id_atividade}/finish", headers=auth_ong)
        check("finaliza apos validar presenca", r.status_code == 200, r.text[:200])
        check("gerou 1 certificado", r.json().get("certificadosGerados") == 1, r.text[:200])

        r = client.get("/api/certificates/my", headers=auth_aluno)
        check("aluno lista certificados", r.status_code == 200 and len(r.json()) == 1)
        certificado = r.json()[0]
        codigo = certificado["verificationCode"]
        id_certificado = certificado["_id"]
        check("certificado tem 4 horas", certificado["hours"] == 4)
        check("codigo tem 16 chars hex", len(codigo) == 16)

        r = client.get(f"/api/certificates/validate/{codigo}")
        check("verificacao publica funciona sem token", r.status_code == 200, r.text[:200])
        check("responde valid=true", r.json().get("valid") is True)
        val = r.json()["certificate"]
        check("traz nome do aluno", val["user"]["name"] == "Aluno Teste")
        check("traz titulo da atividade", val["activity"]["title"] == "Mutirao de limpeza")
        check("traz a ONG responsavel", val["activity"]["createdBy"]["name"] == "ONG Teste")

        r = client.get("/api/certificates/validate/codigoinexistente")
        check("codigo inexistente responde 404", r.status_code == 404)
        check("responde valid=false", r.json().get("valid") is False)

        r = client.get(f"/api/certificates/{id_certificado}/pdf", headers=auth_aluno)
        check("PDF privado gera", r.status_code == 200, r.text[:120])
        check("content-type e PDF", r.headers.get("content-type") == "application/pdf")
        check("bytes sao mesmo um PDF", r.content[:5] == b"%PDF-")

        r = client.get(f"/api/certificates/public/{codigo}/pdf")
        check("PDF publico gera sem token", r.status_code == 200)
        check("PDF publico valido", r.content[:5] == b"%PDF-")

        secao("Dashboard")
        r = client.get("/api/dashboard/student", headers=auth_aluno)
        check("dashboard do aluno responde", r.status_code == 200, r.text[:200])
        d = r.json()
        check("totalHours soma 4", d.get("totalHours") == 4, str(d.get("totalHours")))
        check("traz participations", len(d.get("participations", [])) == 1)
        check("traz certificates", len(d.get("certificates", [])) == 1)

        r = client.get("/api/dashboard/student", headers=auth_ong)
        check("ONG no dashboard de aluno recebe 403", r.status_code == 403)

        secao("Logout")
        client.post("/api/users/login", json={"email": email_aluno, "password": senha})
        r = client.post("/api/users/logout")
        check("logout responde 200", r.status_code == 200)
        r = client.post("/api/users/refresh")
        check("refresh apos logout recusado", r.status_code == 401, r.text[:120])

    print(f"\n{'=' * 46}")
    print(f"  PASSOU: {PASSOU}    FALHOU: {FALHOU}")
    print(f"{'=' * 46}")
    return 1 if FALHOU else 0


if __name__ == "__main__":
    sys.exit(main())
