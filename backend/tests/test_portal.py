"""
Portal público (Fatia 9): números de impacto, ONGs parceiras e perfil público.

O estado é montado direto no banco — o que se testa aqui é o que o portal
mostra, não o caminho até a atividade finalizar (esse já tem testes próprios).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import config
from app.db.models import Atividade, Certificado, Inscricao, PerfilOng, Usuario
from app.db.session import obter_sessao
from app.main import app

AGORA = datetime.now(timezone.utc)


@pytest.fixture
async def cliente(sessao):
    async def _sessao_de_teste():
        yield sessao

    app.dependency_overrides[obter_sessao] = _sessao_de_teste
    async with AsyncClient(transport=ASGITransport(app=app),
                           base_url="http://teste") as c:
        yield c
    app.dependency_overrides.clear()


async def _usuario(sessao, papel: str, nome: str, situacao: str = "ativa") -> Usuario:
    suspensa = situacao == "suspensa"
    usuario = Usuario(nome=nome, email=f"{uuid.uuid4().hex[:12]}@teste.com",
                      senha_hash="x", papel=papel, situacao=situacao,
                      suspenso_em=AGORA if suspensa else None,
                      motivo_suspensao="teste" if suspensa else None)
    sessao.add(usuario)
    await sessao.flush()
    return usuario


async def _ong(sessao, nome: str, *, cidade: str = "Fortaleza",
               verificada: bool = False, situacao: str = "ativa") -> Usuario:
    ong = await _usuario(sessao, "ong", nome, situacao)
    sessao.add(PerfilOng(
        usuario_id=ong.id, nome_organizacao=nome, cidade=cidade, estado="CE",
        descricao="Cuidamos da praia.", telefone="85 99999-0000",
        cnpj="12.345.678/0001-90", endereco="Rua da Casa da Presidente, 10",
        site="https://exemplo.org", verificada_em=AGORA if verificada else None,
    ))
    await sessao.flush()
    return ong


async def _atividade(sessao, ong: Usuario, situacao: str, *,
                     dias: int = 3, carga: int = 4) -> Atividade:
    atividade = Atividade(
        ong_id=ong.id, titulo=f"Ação {situacao}", descricao="Descrição da ação.",
        local="Praia", cidade="Fortaleza", estado="CE",
        data=date.today() + timedelta(days=dias),
        hora_inicio=time(8), hora_fim=time(12), carga_horaria=carga,
        vagas_min=1, vagas_max=10, situacao=situacao,
    )
    sessao.add(atividade)
    await sessao.flush()
    return atividade


async def _certificado(sessao, atividade: Atividade, horas: int, *,
                       revogado: bool = False) -> Certificado:
    aluno = await _usuario(sessao, "estudante", "Aluno")
    inscricao = Inscricao(atividade_id=atividade.id, usuario_id=aluno.id,
                          situacao="presente", carga_horaria_creditada=horas)
    sessao.add(inscricao)
    await sessao.flush()
    cert = Certificado(
        inscricao_id=inscricao.id, usuario_id=aluno.id, atividade_id=atividade.id,
        codigo_verificacao=uuid.uuid4().hex[:16], horas=horas,
        nome_no_certificado="Aluno", nome_organizacao="ONG",
        titulo_atividade=atividade.titulo, data_atividade=atividade.data,
        assinatura="x", revogado_em=AGORA if revogado else None,
        motivo_revogacao="teste" if revogado else None,
    )
    sessao.add(cert)
    await sessao.flush()
    return cert


# ===================== Resumo (T1) =====================


async def test_resumo_zerado_nao_inventa_numero(cliente):
    resposta = await cliente.get("/api/v1/portal/resumo")
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo == {
        "atividadesRealizadas": 0, "atividadesAbertas": 0, "horasCertificadas": 0,
        "certificadosEmitidos": 0, "estudantes": 0, "ongs": 0,
        "codigoDemonstracao": None,
    }


async def test_resumo_conta_so_o_que_vale(cliente, sessao):
    ong = await _ong(sessao, "Verde Vida")
    finalizada = await _atividade(sessao, ong, "finalizada", dias=-5)
    await _atividade(sessao, ong, "cancelada")
    await _atividade(sessao, ong, "rascunho")
    await _atividade(sessao, ong, "publicada")                 # aberta
    await _atividade(sessao, ong, "publicada", dias=-2)        # já passou
    await _certificado(sessao, finalizada, 4)
    await _certificado(sessao, finalizada, 3)
    await _certificado(sessao, finalizada, 9, revogado=True)   # não conta
    await _usuario(sessao, "estudante", "Suspenso", situacao="suspensa")

    corpo = (await cliente.get("/api/v1/portal/resumo")).json()

    assert corpo["atividadesRealizadas"] == 1
    assert corpo["atividadesAbertas"] == 1
    assert corpo["certificadosEmitidos"] == 2
    assert corpo["horasCertificadas"] == 7
    assert corpo["estudantes"] == 3        # os três alunos dos certificados
    assert corpo["ongs"] == 1


async def test_vaga_de_ong_suspensa_nao_conta_como_aberta(cliente, sessao):
    suspensa = await _ong(sessao, "Suspensa", situacao="suspensa")
    await _atividade(sessao, suspensa, "publicada")

    corpo = (await cliente.get("/api/v1/portal/resumo")).json()

    assert corpo["atividadesAbertas"] == 0
    assert corpo["ongs"] == 0


async def test_codigo_de_demonstracao_so_aparece_se_valer(cliente, sessao, monkeypatch):
    ong = await _ong(sessao, "Demo")
    atividade = await _atividade(sessao, ong, "finalizada", dias=-1)
    valido = await _certificado(sessao, atividade, 2)
    revogado = await _certificado(sessao, atividade, 2, revogado=True)

    async def codigo() -> str | None:
        return (await cliente.get("/api/v1/portal/resumo")).json()["codigoDemonstracao"]

    monkeypatch.setattr(config, "certificado_demonstracao", valido.codigo_verificacao)
    assert await codigo() == valido.codigo_verificacao

    monkeypatch.setattr(config, "certificado_demonstracao", revogado.codigo_verificacao)
    assert await codigo() is None

    monkeypatch.setattr(config, "certificado_demonstracao", "naoexiste00000000")
    assert await codigo() is None


# ===================== ONGs parceiras (T5) =====================


async def test_so_aparece_ong_ativa_que_ja_publicou(cliente, sessao):
    com_publicada = await _ong(sessao, "Publicou")
    await _atividade(sessao, com_publicada, "publicada")
    com_finalizada = await _ong(sessao, "Realizou")
    await _atividade(sessao, com_finalizada, "finalizada", dias=-3)
    so_rascunho = await _ong(sessao, "Só rascunho")
    await _atividade(sessao, so_rascunho, "rascunho")
    so_cancelada = await _ong(sessao, "Só cancelada")
    await _atividade(sessao, so_cancelada, "cancelada")
    await _ong(sessao, "Recém-criada")
    suspensa = await _ong(sessao, "Suspensa", situacao="suspensa")
    await _atividade(sessao, suspensa, "finalizada", dias=-3)

    corpo = (await cliente.get("/api/v1/portal/ongs")).json()

    assert corpo["total"] == 2
    assert {o["nome"] for o in corpo["itens"]} == {"Publicou", "Realizou"}


async def test_verificada_primeiro_depois_quem_mais_fez(cliente, sessao):
    muito = await _ong(sessao, "Muito ativa")
    for _ in range(3):
        await _atividade(sessao, muito, "finalizada", dias=-3)
    pouco = await _ong(sessao, "Pouco ativa")
    await _atividade(sessao, pouco, "finalizada", dias=-3)
    verificada = await _ong(sessao, "Verificada", verificada=True)
    await _atividade(sessao, verificada, "publicada")

    corpo = (await cliente.get("/api/v1/portal/ongs")).json()

    assert [o["nome"] for o in corpo["itens"]] == [
        "Verificada", "Muito ativa", "Pouco ativa"]
    primeira = corpo["itens"][0]
    assert primeira["verificada"] is True
    assert primeira["atividadesAbertas"] == 1
    assert corpo["itens"][1]["atividadesRealizadas"] == 3


async def test_contagem_nao_se_multiplica_com_varias_atividades(cliente, sessao):
    ong = await _ong(sessao, "Várias")
    for _ in range(2):
        await _atividade(sessao, ong, "finalizada", dias=-3)
    for _ in range(3):
        await _atividade(sessao, ong, "publicada")

    item = (await cliente.get("/api/v1/portal/ongs")).json()["itens"][0]

    assert item["atividadesRealizadas"] == 2
    assert item["atividadesAbertas"] == 3


async def test_busca_por_nome_ou_cidade_e_paginacao(cliente, sessao):
    for i in range(3):
        ong = await _ong(sessao, f"Fortal {i}")
        await _atividade(sessao, ong, "publicada")
    sobral = await _ong(sessao, "Sertão Vivo", cidade="Sobral")
    await _atividade(sessao, sobral, "publicada")

    por_cidade = (await cliente.get("/api/v1/portal/ongs",
                                    params={"busca": "sobral"})).json()
    assert [o["nome"] for o in por_cidade["itens"]] == ["Sertão Vivo"]

    por_nome = (await cliente.get("/api/v1/portal/ongs",
                                  params={"busca": "fortal", "tamanho": 2})).json()
    assert por_nome["total"] == 3
    assert por_nome["paginas"] == 2
    assert len(por_nome["itens"]) == 2


async def test_listagem_nao_expoe_contato(cliente, sessao):
    ong = await _ong(sessao, "Discreta")
    await _atividade(sessao, ong, "publicada")

    texto = (await cliente.get("/api/v1/portal/ongs")).text

    for sensivel in ("99999-0000", "12.345.678", "Rua da Casa", "@teste.com"):
        assert sensivel not in texto


# ===================== Perfil público da ONG =====================


async def test_perfil_publico_da_ong(cliente, sessao):
    ong = await _ong(sessao, "Verde Vida", verificada=True)
    feita = await _atividade(sessao, ong, "finalizada", dias=-10)
    await _certificado(sessao, feita, 4)
    await _certificado(sessao, feita, 4, revogado=True)
    aberta = await _atividade(sessao, ong, "publicada")
    await _atividade(sessao, ong, "rascunho")
    outra = await _ong(sessao, "Outra")
    await _atividade(sessao, outra, "publicada")

    resposta = await cliente.get(f"/api/v1/portal/ongs/{ong.id}")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["nome"] == "Verde Vida"
    assert corpo["verificada"] is True
    assert corpo["site"] == "https://exemplo.org"
    assert corpo["atividadesRealizadas"] == 1
    assert corpo["horasCertificadas"] == 4
    assert [a["id"] for a in corpo["proximasAtividades"]] == [str(aberta.id)]
    for sensivel in ("99999-0000", "12.345.678", "Rua da Casa", "@teste.com"):
        assert sensivel not in resposta.text


@pytest.mark.parametrize("caso", ["estudante", "suspensa", "inexistente"])
async def test_perfil_publico_so_de_ong_ativa(cliente, sessao, caso):
    if caso == "estudante":
        alvo = (await _usuario(sessao, "estudante", "Maria")).id
    elif caso == "suspensa":
        alvo = (await _ong(sessao, "Suspensa", situacao="suspensa")).id
    else:
        alvo = uuid.uuid4()

    resposta = await cliente.get(f"/api/v1/portal/ongs/{alvo}")

    assert resposta.status_code == 404
    assert resposta.json()["codigo"] == "nao_encontrado"


async def test_portal_nao_pede_login_mesmo_com_token_invalido(cliente, sessao):
    ong = await _ong(sessao, "Aberta")
    cabecalho = {"Authorization": "Bearer lixo"}

    for rota in ("/api/v1/portal/resumo", "/api/v1/portal/ongs",
                 f"/api/v1/portal/ongs/{ong.id}"):
        assert (await cliente.get(rota, headers=cabecalho)).status_code == 200
