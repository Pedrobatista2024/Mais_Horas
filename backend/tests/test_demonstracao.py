"""
Testes da limpeza dos dados de demonstração (`python -m app.cli remover-demonstracao`).

Roda em produção, então o que mais importa é o que **não** pode sair: conta,
atividade e linha da trilha de quem não é de demonstração.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.cli import DOMINIO_DEMONSTRACAO, remover_demonstracao
from app.core import rate_limit
from app.db.models import Atividade, Inscricao, RegistroAuditoria, Usuario
from app.db.session import obter_sessao
from app.main import app
from app.services.atividade_service import hoje

SENHA = "senha-bem-longa-123"


@pytest.fixture(autouse=True)
def _sem_limite():
    rate_limit.zerar()
    yield
    rate_limit.zerar()


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    transporte = ASGITransport(app=app)
    async with AsyncClient(transport=transporte, base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


def _como(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _conta(cliente, papel: str, dominio: str) -> tuple[str, str]:
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Conta de Teste", "email": f"{uuid.uuid4().hex[:10]}@{dominio}",
        "senha": SENHA, "papel": papel})
    assert resposta.status_code == 201, resposta.text
    corpo = resposta.json()
    return corpo["usuario"]["id"], corpo["token"]


async def _atividade(cliente, token: str) -> str:
    criada = await cliente.post("/api/v1/atividades", headers=_como(token), json={
        "titulo": "Mutirão de limpeza", "descricao": "Limpeza da praia.",
        "local": "Praia do Futuro", "cidade": "Fortaleza",
        "data": (hoje() + timedelta(days=3)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "12:00", "vagas_min": 1, "vagas_max": 10})
    atividade_id = criada.json()["id"]
    await cliente.post(f"/api/v1/atividades/{atividade_id}/publicar", headers=_como(token))
    return atividade_id


async def _cenario(cliente):
    """Uma ONG e um aluno de verdade, os mesmos de demonstração, e cada um na vaga do outro."""
    ong_real, token_ong_real = await _conta(cliente, "ong", "teste.com")
    aluno_real, token_aluno_real = await _conta(cliente, "estudante", "teste.com")
    ong_demo, token_ong_demo = await _conta(cliente, "ong", DOMINIO_DEMONSTRACAO)
    aluno_demo, token_aluno_demo = await _conta(cliente, "estudante", DOMINIO_DEMONSTRACAO)
    for token in (token_aluno_real, token_aluno_demo):
        await cliente.put("/api/v1/perfil", headers=_como(token), json={
            "nome_completo": "Maria da Silva Souza", "instituicao": "UniC",
            "curso": "Sistemas de Informação"})

    vaga_real = await _atividade(cliente, token_ong_real)
    vaga_demo = await _atividade(cliente, token_ong_demo)
    for token, vaga in ((token_aluno_demo, vaga_real), (token_aluno_real, vaga_demo)):
        resposta = await cliente.post("/api/v1/inscricoes", headers=_como(token),
                                      json={"atividadeId": vaga})
        assert resposta.status_code == 201, resposta.text

    # Uma força bruta simulada (IP de documentação) e um erro de digitação real.
    await cliente.post("/api/v1/auth/entrar", headers={"X-Forwarded-For": "203.0.113.7"},
                       json={"email": "ninguem@teste.com", "senha": "chute"})
    await cliente.post("/api/v1/auth/entrar", headers={"X-Forwarded-For": "177.10.20.30"},
                       json={"email": "ninguem@teste.com", "senha": "chute"})
    return {"ong_real": ong_real, "aluno_real": aluno_real, "ong_demo": ong_demo,
            "aluno_demo": aluno_demo, "vaga_real": vaga_real, "vaga_demo": vaga_demo}


async def _existe(sessao, modelo, ident: str) -> bool:
    return await sessao.get(modelo, uuid.UUID(ident)) is not None


async def _linhas_do_ip(sessao, ip: str) -> int:
    return await sessao.scalar(select(func.count()).select_from(RegistroAuditoria)
                               .where(func.host(RegistroAuditoria.ip) == ip))


async def test_sem_confirmar_so_conta(cliente, sessao):
    ids = await _cenario(cliente)

    contagem = await remover_demonstracao(sessao, confirmar=False)

    assert contagem["contas"] == 2
    assert contagem["atividades"] == 1
    # A inscrição do aluno de demonstração na vaga real e a do aluno real na
    # vaga de demonstração: as duas nasceram de dado de demonstração.
    assert contagem["inscricoes"] == 2
    assert await _existe(sessao, Usuario, ids["aluno_demo"])
    assert await _linhas_do_ip(sessao, "203.0.113.7") == 1


async def test_confirmar_apaga_a_demonstracao_e_preserva_o_resto(cliente, sessao):
    ids = await _cenario(cliente)

    await remover_demonstracao(sessao, confirmar=True)
    sessao.expunge_all()

    assert not await _existe(sessao, Usuario, ids["ong_demo"])
    assert not await _existe(sessao, Usuario, ids["aluno_demo"])
    assert not await _existe(sessao, Atividade, ids["vaga_demo"])
    assert await _linhas_do_ip(sessao, "203.0.113.7") == 0

    # O que é de verdade continua lá.
    assert await _existe(sessao, Usuario, ids["ong_real"])
    assert await _existe(sessao, Usuario, ids["aluno_real"])
    assert await _existe(sessao, Atividade, ids["vaga_real"])
    assert await _linhas_do_ip(sessao, "177.10.20.30") == 1
    restantes = await sessao.scalar(select(func.count()).select_from(Inscricao).where(
        Inscricao.atividade_id == uuid.UUID(ids["vaga_real"])))
    assert restantes == 0
    cadastro_real = await sessao.scalar(select(func.count()).select_from(RegistroAuditoria)
                                        .where(RegistroAuditoria.acao == "conta.criada",
                                               RegistroAuditoria.ator_id.in_([
                                                   uuid.UUID(ids["ong_real"]),
                                                   uuid.UUID(ids["aluno_real"])])))
    assert cadastro_real == 2


async def test_a_limpeza_fica_registrada(cliente, sessao):
    await _cenario(cliente)

    await remover_demonstracao(sessao, confirmar=True)

    registro = await sessao.scalar(select(RegistroAuditoria).where(
        RegistroAuditoria.acao == "sistema.demonstracao_removida"))
    assert registro is not None
    assert registro.depois["contas"] == 2
