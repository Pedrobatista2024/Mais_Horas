"""Testes do fluxo de perfil — FE-09 de docs/fluxos.md."""

from __future__ import annotations

import io
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit
from app.db.models import RegistroAuditoria
from app.db.session import obter_sessao
from app.main import app

SENHA = "senha-bem-longa-123"


@pytest.fixture(autouse=True)
def _sem_limite():
    rate_limit.zerar()
    yield
    rate_limit.zerar()


@pytest.fixture(autouse=True)
def _uploads_isolados(tmp_path, monkeypatch):
    """Teste de upload não pode sujar a pasta real de uploads."""
    from app.core.config import config
    monkeypatch.setattr(config, "upload_dir", str(tmp_path / "uploads"))


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


async def _entrar(cliente, papel="estudante") -> str:
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": "Maria Silva", "email": f"{uuid.uuid4().hex[:12]}@teste.com",
        "senha": SENHA, "papel": papel,
    })
    token = resposta.json()["token"]
    cliente.headers["Authorization"] = f"Bearer {token}"
    return resposta.json()["usuario"]["id"]


def _png() -> bytes:
    """PNG 1×1 válido, menor imagem possível."""
    import base64
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )


# ===================== Leitura =====================


async def test_perfil_nasce_vazio_e_incompleto(cliente):
    await _entrar(cliente)
    corpo = (await cliente.get("/api/v1/perfil")).json()

    assert corpo["perfilCompleto"] is False
    assert set(corpo["camposFaltantes"]) == {"nome_completo", "instituicao", "curso"}
    assert corpo["perfil"]["nome_completo"] is None


async def test_perfil_exige_autenticacao(cliente):
    assert (await cliente.get("/api/v1/perfil")).status_code == 401


async def test_perfil_nao_devolve_senha(cliente):
    await _entrar(cliente)
    assert "senha" not in (await cliente.get("/api/v1/perfil")).text.lower()


async def test_ong_nao_recebe_campos_de_estudante(cliente):
    await _entrar(cliente, "ong")
    corpo = (await cliente.get("/api/v1/perfil")).json()

    assert "nome_organizacao" in corpo["perfil"]
    assert "curso" not in corpo["perfil"]
    # RN-13 vale só para estudante.
    assert corpo["perfilCompleto"] is None


# ===================== Atualização =====================


async def test_preencher_os_tres_campos_libera_a_inscricao(cliente):
    """RN-13 — é este sinal que a vitrine consulta antes de deixar inscrever."""
    await _entrar(cliente)

    resposta = await cliente.put("/api/v1/perfil", json={
        "nome_completo": "Maria Aparecida Silva",
        "instituicao": "UniC",
        "curso": "Sistemas de Informação",
    })

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["perfilCompleto"] is True
    assert corpo["camposFaltantes"] == []


async def test_perfil_parcial_continua_incompleto(cliente):
    await _entrar(cliente)
    corpo = (await cliente.put("/api/v1/perfil", json={
        "nome_completo": "Maria Silva", "instituicao": "UniC",
    })).json()

    assert corpo["perfilCompleto"] is False
    assert corpo["camposFaltantes"] == ["curso"]


async def test_campo_so_de_espacos_nao_conta_como_preenchido(cliente):
    await _entrar(cliente)
    corpo = (await cliente.put("/api/v1/perfil", json={
        "nome_completo": "Maria", "instituicao": "   ", "curso": "SI",
    })).json()

    assert corpo["perfilCompleto"] is False
    assert corpo["camposFaltantes"] == ["instituicao"]


async def test_atualizacao_parcial_preserva_o_resto(cliente):
    """Campo ausente significa 'não mexa', não 'apague'."""
    await _entrar(cliente)
    await cliente.put("/api/v1/perfil", json={
        "nome_completo": "Maria Silva", "instituicao": "UniC", "curso": "SI",
        "cidade": "Fortaleza",
    })

    corpo = (await cliente.put("/api/v1/perfil", json={"curso": "Engenharia"})).json()

    assert corpo["perfil"]["curso"] == "Engenharia"
    assert corpo["perfil"]["cidade"] == "Fortaleza"
    assert corpo["perfil"]["nome_completo"] == "Maria Silva"


async def test_campo_nulo_apaga_o_valor(cliente):
    """Nulo explícito é 'apague' — a diferença para ausente importa."""
    await _entrar(cliente)
    await cliente.put("/api/v1/perfil", json={"cidade": "Fortaleza"})

    corpo = (await cliente.put("/api/v1/perfil", json={"cidade": None})).json()
    assert corpo["perfil"]["cidade"] is None


async def test_string_vazia_vira_nulo(cliente):
    """O formulário manda "" ao limpar o campo; guardar nulo evita dois vazios."""
    await _entrar(cliente)
    corpo = (await cliente.put("/api/v1/perfil", json={"cidade": "   "})).json()
    assert corpo["perfil"]["cidade"] is None


async def test_nome_de_exibicao_tambem_e_atualizavel(cliente):
    await _entrar(cliente)
    corpo = (await cliente.put("/api/v1/perfil", json={"nome": "Mari"})).json()
    assert corpo["nome"] == "Mari"


async def test_campo_acima_do_limite_e_recusado(cliente):
    await _entrar(cliente)
    resposta = await cliente.put("/api/v1/perfil", json={"curso": "x" * 200})

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "dados_invalidos"


async def test_campo_desconhecido_e_recusado(cliente):
    """Impede que um erro de digitação passe despercebido como campo ignorado."""
    await _entrar(cliente)
    resposta = await cliente.put("/api/v1/perfil", json={"salario": 9999})
    assert resposta.status_code == 400


async def test_atualizacao_fica_na_auditoria_com_antes_e_depois(cliente, sessao):
    await _entrar(cliente)
    await cliente.put("/api/v1/perfil", json={"curso": "Sistemas de Informação"})

    registro = await sessao.scalar(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "perfil.atualizado")
        .order_by(RegistroAuditoria.id.desc())
    )
    assert registro is not None
    assert registro.depois["curso"] == "Sistemas de Informação"


async def test_atualizacao_sem_mudanca_nao_polui_a_auditoria(cliente, sessao):
    await _entrar(cliente)
    await cliente.put("/api/v1/perfil", json={"curso": "SI"})
    antes = len((await sessao.scalars(
        select(RegistroAuditoria).where(RegistroAuditoria.acao == "perfil.atualizado")
    )).all())

    await cliente.put("/api/v1/perfil", json={"curso": "SI"})  # mesmo valor
    depois = len((await sessao.scalars(
        select(RegistroAuditoria).where(RegistroAuditoria.acao == "perfil.atualizado")
    )).all())

    assert depois == antes


# ===================== Foto =====================


async def test_envio_de_foto(cliente):
    await _entrar(cliente)
    resposta = await cliente.post(
        "/api/v1/perfil/foto",
        files={"foto": ("avatar.png", io.BytesIO(_png()), "image/png")},
    )

    assert resposta.status_code == 200
    assert resposta.json()["perfil"]["foto"].endswith(".png")


async def test_arquivo_que_nao_e_imagem_e_recusado(cliente):
    await _entrar(cliente)
    resposta = await cliente.post(
        "/api/v1/perfil/foto",
        files={"foto": ("virus.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "arquivo_invalido"


async def test_arquivo_grande_demais_e_recusado(cliente, monkeypatch):
    from app.core.config import config

    monkeypatch.setattr(config, "upload_max_bytes", 100)
    await _entrar(cliente)
    resposta = await cliente.post(
        "/api/v1/perfil/foto",
        files={"foto": ("grande.png", io.BytesIO(b"x" * 500), "image/png")},
    )

    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "arquivo_muito_grande"


async def test_trocar_a_foto_apaga_a_anterior(cliente):
    from pathlib import Path

    await _entrar(cliente)

    primeira = (await cliente.post(
        "/api/v1/perfil/foto",
        files={"foto": ("a.png", io.BytesIO(_png()), "image/png")},
    )).json()["perfil"]["foto"]

    await cliente.post(
        "/api/v1/perfil/foto",
        files={"foto": ("b.png", io.BytesIO(_png()), "image/png")},
    )

    assert not Path(primeira).exists()


async def test_remover_foto(cliente):
    await _entrar(cliente)
    await cliente.post("/api/v1/perfil/foto",
                       files={"foto": ("a.png", io.BytesIO(_png()), "image/png")})

    corpo = (await cliente.delete("/api/v1/perfil/foto")).json()
    assert corpo["perfil"]["foto"] is None


async def test_remover_foto_inexistente_nao_quebra(cliente):
    await _entrar(cliente)
    assert (await cliente.delete("/api/v1/perfil/foto")).status_code == 200


async def test_ong_envia_logo_e_nao_foto(cliente):
    await _entrar(cliente, "ong")
    corpo = (await cliente.post(
        "/api/v1/perfil/foto",
        files={"foto": ("logo.png", io.BytesIO(_png()), "image/png")},
    )).json()

    assert corpo["perfil"]["logo"] is not None
    assert "foto" not in corpo["perfil"]


# ===================== Perfil público =====================


async def test_perfil_publico_de_estudante_omite_dado_sensivel(cliente):
    """Telefone, bairro e e-mail não são de terceiros."""
    outro_id = await _entrar(cliente)
    await cliente.put("/api/v1/perfil", json={
        "nome_completo": "Maria Silva", "instituicao": "UniC", "curso": "SI",
        "telefone": "85999999999", "bairro": "Centro",
    })

    await _entrar(cliente)  # entra como outra pessoa
    corpo = (await cliente.get(f"/api/v1/usuarios/{outro_id}/publico")).json()

    assert corpo["nome"] == "Maria Silva"
    assert corpo["perfil"]["curso"] == "SI"
    assert "telefone" not in corpo["perfil"]
    assert "bairro" not in corpo["perfil"]
    assert "email" not in corpo


async def test_perfil_publico_de_ong_mostra_contato(cliente):
    """A ONG precisa ser encontrável — contato dela é público por natureza."""
    ong_id = await _entrar(cliente, "ong")
    await cliente.put("/api/v1/perfil", json={
        "nome_organizacao": "ONG Verde Vida", "telefone": "8533333333",
        "descricao": "Cuidamos de praças",
    })

    await _entrar(cliente)
    corpo = (await cliente.get(f"/api/v1/usuarios/{ong_id}/publico")).json()

    assert corpo["nome"] == "ONG Verde Vida"
    assert corpo["perfil"]["telefone"] == "8533333333"
    assert corpo["perfil"]["verificada"] is False


async def test_perfil_publico_exige_login(cliente):
    """Evita varredura de perfis por quem nem usa a plataforma."""
    alvo = await _entrar(cliente)
    cliente.headers.pop("Authorization")

    assert (await cliente.get(f"/api/v1/usuarios/{alvo}/publico")).status_code == 401


async def test_perfil_publico_de_conta_inexistente(cliente):
    await _entrar(cliente)
    resposta = await cliente.get(f"/api/v1/usuarios/{uuid.uuid4()}/publico")
    assert resposta.status_code == 404
