"""
Prova pública do certificado (Fatia 11).

O teste central aqui não usa o nosso verificador: ele pega o texto assinado, a
assinatura e a chave pública que a API entrega e confere **por fora**, direto
na biblioteca de criptografia. É isso que a banca vai querer ver — que a
validação não depende de acreditar na nossa resposta.
"""

from __future__ import annotations

import base64
import json
import uuid
from datetime import timedelta

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit, security
from app.core.config import config
from app.db.models import Atividade, Certificado, Inscricao, Usuario
from app.db.session import obter_sessao
from app.main import app
from app.services.atividade_service import hoje

SENHA = "senha-bem-longa-123"


@pytest.fixture(autouse=True)
def _ambiente(monkeypatch):
    privada, _ = security.gerar_par_de_chaves()
    monkeypatch.setattr(config, "chave_assinatura", privada)
    rate_limit.zerar()
    yield
    rate_limit.zerar()


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


def _como(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _cadastrar(cliente, papel: str) -> tuple[str, str]:
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "ONG Verde Vida" if papel == "ong" else "Maria Silva",
        "email": f"{uuid.uuid4().hex[:12]}@teste.com",
        "senha": SENHA, "papel": papel,
    })
    corpo = resposta.json()
    return corpo["usuario"]["id"], corpo["token"]


async def _certificado_emitido(cliente, sessao) -> dict:
    """Percorre o caminho real: publica, inscreve, marca presença e finaliza."""
    _, ong = await _cadastrar(cliente, "ong")
    aluno_id, aluno = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(aluno), json={
        "nome_completo": "Maria Silva Souza", "instituicao": "UniC",
        "curso": "Sistemas de Informação"})

    criada = await cliente.post("/api/v1/atividades", headers=_como(ong), json={
        "titulo": "Mutirão de limpeza", "descricao": "Limpeza da praia.",
        "local": "Praia do Futuro", "cidade": "Fortaleza", "estado": "CE",
        "data": (hoje() + timedelta(days=1)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "12:00",
        "vagas_min": 1, "vagas_max": 10})
    atividade = criada.json()
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/publicar",
                       headers=_como(ong))
    await cliente.post("/api/v1/inscricoes", headers=_como(aluno),
                       json={"atividadeId": atividade["id"]})

    # A atividade precisa ter terminado para a presença ser validada.
    gravada = await sessao.get(Atividade, uuid.UUID(atividade["id"]))
    gravada.data = hoje() - timedelta(days=1)
    await sessao.commit()

    inscricao = await sessao.scalar(
        select(Inscricao).where(Inscricao.usuario_id == uuid.UUID(aluno_id)))
    await cliente.put(f"/api/v1/inscricoes/{inscricao.id}/presenca",
                      headers=_como(ong), json={"situacao": "presente"})
    await cliente.post(f"/api/v1/atividades/{atividade['id']}/finalizar",
                       headers=_como(ong))

    cert = await sessao.scalar(select(Certificado))
    return {"codigo": cert.codigo_verificacao, "cert": cert}


def _confere_por_fora(prova: dict) -> bool:
    """Verificação independente: só a biblioteca de criptografia e o PEM."""
    chave = serialization.load_pem_public_key(prova["chavePublica"].encode())
    try:
        chave.verify(base64.b64decode(prova["assinatura"]),
                     prova["textoAssinado"].encode("utf-8"))
        return True
    except InvalidSignature:
        return False


# ===================== A prova =====================


async def test_prova_confere_fora_do_nosso_codigo(cliente, sessao):
    emitido = await _certificado_emitido(cliente, sessao)

    resposta = await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")

    assert resposta.status_code == 200
    prova = resposta.json()
    assert prova["algoritmo"] == "Ed25519"
    assert prova["formatoDoTexto"] == "MHC1"
    assert prova["chavePublica"].startswith("-----BEGIN PUBLIC KEY-----")
    assert _confere_por_fora(prova) is True


async def test_texto_assinado_traz_o_que_o_certificado_mostra(cliente, sessao):
    emitido = await _certificado_emitido(cliente, sessao)
    cert = emitido["cert"]

    prova = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")).json()
    campos = json.loads(prova["textoAssinado"])

    assert campos[0] == "MHC1"
    assert campos[1] == cert.codigo_verificacao
    assert campos[2] == cert.nome_no_certificado
    assert campos[3] == cert.nome_organizacao
    assert campos[4] == cert.titulo_atividade
    assert campos[5] == cert.horas
    assert campos[6] == cert.data_atividade.isoformat()


async def test_registro_alterado_quebra_a_prova(cliente, sessao):
    """O que a banca vai querer ver: mexeu no banco, a conta não fecha mais."""
    emitido = await _certificado_emitido(cliente, sessao)
    cert = emitido["cert"]
    antes = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")).json()
    assert _confere_por_fora(antes) is True

    cert.horas = cert.horas + 40
    await sessao.commit()

    depois = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")).json()

    assert _confere_por_fora(depois) is False
    assert json.loads(depois["textoAssinado"])[5] == cert.horas
    # E a verificação normal conta a mesma história.
    verificacao = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}")).json()
    assert verificacao["desfecho"] == "adulterado"


async def test_revogado_mantem_prova_valida(cliente, sessao):
    """Revogar é decisão da instituição, não defeito da assinatura."""
    emitido = await _certificado_emitido(cliente, sessao)
    emitido["cert"].revogado_em = emitido["cert"].emitido_em
    emitido["cert"].motivo_revogacao = "teste"
    await sessao.commit()

    prova = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")).json()

    assert prova["revogado"] is True
    assert _confere_por_fora(prova) is True


async def test_prova_de_codigo_inexistente(cliente):
    resposta = await cliente.get(
        "/api/v1/certificados/verificar/ffffffffffffffff/prova")

    assert resposta.status_code == 404
    assert resposta.json()["codigo"] == "nao_encontrado"


async def test_prova_nao_expoe_chave_privada(cliente, sessao):
    emitido = await _certificado_emitido(cliente, sessao)

    texto = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")).text

    assert "PRIVATE KEY" not in texto
    assert config.chave_assinatura not in texto


# ===================== A chave pública =====================


async def test_chave_publica_e_aberta_e_bate_com_a_prova(cliente, sessao):
    emitido = await _certificado_emitido(cliente, sessao)

    resposta = await cliente.get("/api/v1/portal/chave-publica")

    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("application/x-pem-file")
    assert "PRIVATE" not in resposta.text
    prova = (await cliente.get(
        f"/api/v1/certificados/verificar/{emitido['codigo']}/prova")).json()
    assert resposta.text.strip() == prova["chavePublica"].strip()


async def test_sem_chave_configurada_a_rota_avisa(cliente, monkeypatch):
    monkeypatch.setattr(config, "chave_assinatura", "")

    resposta = await cliente.get("/api/v1/portal/chave-publica")

    assert resposta.status_code == 503
    assert resposta.json()["codigo"] == "emissao_indisponivel"
