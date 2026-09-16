"""
Testes de certificado — FE-07, FE-08, FV-01 e FV-02 de docs/fluxos.md.

O teste que justifica a fatia é o da adulteração: alguém escreve direto no
banco, e a verificação pública precisa acusar — com a mensagem certa.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update

from app.core import rate_limit, security
from app.core.config import config
from app.db.models import (
    Atividade, Certificado, Inscricao, RegistroAuditoria, Usuario,
)
from app.db.session import obter_sessao
from app.main import app

SENHA = "senha-bem-longa-123"


@pytest.fixture(autouse=True)
def _ambiente(monkeypatch):
    """Chave própria dos testes e contadores zerados."""
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


async def _cadastrar(cliente, papel: str, nome: str | None = None) -> tuple[str, str]:
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": nome or ("ONG Verde Vida" if papel == "ong" else "Maria Silva"),
        "email": f"{uuid.uuid4().hex[:12]}@teste.com",
        "senha": SENHA, "papel": papel,
    })
    corpo = resposta.json()
    return corpo["usuario"]["id"], corpo["token"]


async def _aluno_pronto(cliente, nome="Maria da Silva Souza") -> tuple[str, str]:
    aluno_id, token = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(token), json={
        "nome_completo": nome, "instituicao": "UniC",
        "curso": "Sistemas de Informação",
    })
    return aluno_id, token


async def _admin(sessao) -> str:
    """Admin não nasce por cadastro público (RN-27): é criado direto no banco."""
    admin = Usuario(nome="Admin", email=f"{uuid.uuid4().hex[:10]}@admin.com",
                    senha_hash=security.gerar_hash_senha(SENHA),
                    papel="superadmin")
    sessao.add(admin)
    await sessao.commit()
    token, _ = security.criar_access_token(admin.id, admin.papel)
    return token


async def _ciclo(cliente, sessao, *, presentes=1, ausentes=0,
                 titulo="Mutirão de limpeza") -> dict:
    """
    Percorre o ciclo inteiro até a finalização e devolve o que interessa.

    É o "demonstrável de ponta a ponta" da fatia, em forma de teste.
    """
    _, ong = await _cadastrar(cliente, "ong")
    criada = await cliente.post("/api/v1/atividades", headers=_como(ong), json={
        "titulo": titulo, "descricao": "Limpeza da praia.",
        "local": "Praia do Futuro", "cidade": "Fortaleza",
        "data": (date.today() + timedelta(days=1)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "12:00",
        "vagas_min": 1, "vagas_max": 20,
    })
    atividade_id = criada.json()["id"]
    await cliente.post(f"/api/v1/atividades/{atividade_id}/publicar",
                       headers=_como(ong))

    alunos = []
    for indice in range(presentes + ausentes):
        _, token = await _aluno_pronto(cliente, nome=f"Aluna Número {indice}")
        inscricao = (await cliente.post("/api/v1/inscricoes", headers=_como(token),
                                        json={"atividadeId": atividade_id})).json()
        alunos.append((token, inscricao["id"], indice < presentes))

    gravada = await sessao.get(Atividade, uuid.UUID(atividade_id))
    gravada.data = date.today() - timedelta(days=1)
    await sessao.commit()

    await cliente.put(
        f"/api/v1/atividades/{atividade_id}/presencas", headers=_como(ong),
        json={"decisoes": [
            {"inscricaoId": inscricao_id,
             "situacao": "presente" if presente else "ausente"}
            for _, inscricao_id, presente in alunos]})

    final = await cliente.post(f"/api/v1/atividades/{atividade_id}/finalizar",
                               headers=_como(ong))
    return {"ong": ong, "atividade_id": atividade_id, "alunos": alunos,
            "finalizacao": final}


async def _certificado_do(cliente, token: str) -> dict:
    corpo = (await cliente.get("/api/v1/certificados/meus",
                               headers=_como(token))).json()
    return corpo["itens"][0]


# ===================== Emissão =====================


async def test_finalizar_emite_certificado_para_quem_esteve(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao, presentes=2, ausentes=1)

    assert ciclo["finalizacao"].status_code == 200, ciclo["finalizacao"].text
    assert ciclo["finalizacao"].json()["certificadosEmitidos"] == 2

    certificados = (await sessao.scalars(
        select(Certificado).where(
            Certificado.atividade_id == uuid.UUID(ciclo["atividade_id"])))).all()
    assert len(certificados) == 2


async def test_ausente_nao_recebe_certificado(cliente, sessao):
    """RN-04 — só presença gera certificado."""
    ciclo = await _ciclo(cliente, sessao, presentes=0, ausentes=1)
    token = ciclo["alunos"][0][0]

    corpo = (await cliente.get("/api/v1/certificados/meus",
                               headers=_como(token))).json()
    assert corpo["total"] == 0
    assert corpo["horasValidas"] == 0


async def test_certificado_nasce_assinado_e_conferindo(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    gravado = await sessao.get(Certificado, uuid.UUID(cert["id"]))
    assert gravado.assinatura
    from app.services.certificado_service import assinatura_confere
    assert assinatura_confere(gravado)


async def test_certificado_usa_o_nome_completo(cliente, sessao):
    """RN-50 — o nome completo, não o de cadastro."""
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    assert cert["aluno"] == "Aluna Número 0"


async def test_codigo_tem_16_hexadecimais(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    assert len(cert["codigo"]) == 16
    int(cert["codigo"], 16)


async def test_emissao_e_auditada(cliente, sessao):
    await _ciclo(cliente, sessao, presentes=2)
    registros = (await sessao.scalars(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "certificado.emitido"))).all()
    assert len(registros) == 2


async def test_sem_chave_nada_muda(cliente, sessao, monkeypatch):
    """
    RN-41 — sem como assinar, a atividade **não** finaliza.

    Finalizar sem certificado deixaria os presentes sem comprovação e sem
    caminho de volta, já que finalizada não aceita nova finalização.
    """
    monkeypatch.setattr(config, "chave_assinatura", "")
    ciclo = await _ciclo(cliente, sessao)

    assert ciclo["finalizacao"].status_code == 503
    assert ciclo["finalizacao"].json()["codigo"] == "emissao_indisponivel"

    atividade = await sessao.get(Atividade, uuid.UUID(ciclo["atividade_id"]))
    await sessao.refresh(atividade)
    assert atividade.situacao == "publicada"
    inscricao = await sessao.get(Inscricao, uuid.UUID(ciclo["alunos"][0][1]))
    await sessao.refresh(inscricao)
    assert inscricao.carga_horaria_creditada == 0


async def test_falha_ao_assinar_no_meio_reverte_tudo(cliente, sessao, monkeypatch):
    """
    RN-41 — se o segundo certificado falhar, o primeiro também não pode ficar.

    Simula a falha dentro do laço de emissão, depois de um certificado já ter
    sido adicionado à sessão.
    """
    original = security.assinar_certificado
    chamadas = {"n": 0}

    def assinar_e_quebrar(texto):
        chamadas["n"] += 1
        if chamadas["n"] == 2:
            raise RuntimeError("HSM fora do ar")
        return original(texto)

    monkeypatch.setattr(security, "assinar_certificado", assinar_e_quebrar)

    with pytest.raises(RuntimeError):
        await _ciclo(cliente, sessao, presentes=2)
    await sessao.rollback()

    # Sem esta checagem o teste passaria por vacuidade se o rollback apagasse
    # tudo: a atividade precisa continuar existindo, só que não finalizada.
    atividades = (await sessao.scalars(select(Atividade))).all()
    assert len(atividades) == 1
    assert atividades[0].situacao == "publicada"
    assert (await sessao.scalars(select(Certificado))).all() == []


# ===================== Minhas certificados (E6) =====================


async def test_meus_soma_as_horas_validas(cliente, sessao):
    """RN-16 — o total do aluno é a soma dos certificados que valem."""
    ciclo = await _ciclo(cliente, sessao)
    corpo = (await cliente.get("/api/v1/certificados/meus",
                               headers=_como(ciclo["alunos"][0][0]))).json()
    assert corpo["horasValidas"] == 4
    assert corpo["itens"][0]["urlVerificacao"].endswith(
        f"/verificar/{corpo['itens'][0]['codigo']}")


async def test_revogado_nao_soma_horas(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    token = ciclo["alunos"][0][0]
    cert = await _certificado_do(cliente, token)
    admin = await _admin(sessao)
    await cliente.post(f"/api/v1/admin/certificados/{cert['id']}/revogar",
                       json={"motivo": "Presença contestada"}, headers=_como(admin))

    corpo = (await cliente.get("/api/v1/certificados/meus",
                               headers=_como(token))).json()
    assert corpo["horasValidas"] == 0
    assert corpo["itens"][0]["revogado"] is True


async def test_aluno_so_ve_os_proprios(cliente, sessao):
    await _ciclo(cliente, sessao)
    _, outro = await _aluno_pronto(cliente)

    corpo = (await cliente.get("/api/v1/certificados/meus",
                               headers=_como(outro))).json()
    assert corpo["total"] == 0


async def test_ong_nao_lista_certificados_de_aluno(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    resposta = await cliente.get("/api/v1/certificados/meus",
                                 headers=_como(ciclo["ong"]))
    assert resposta.status_code == 403


# ===================== Verificação pública (T6) =====================


async def test_valido_mostra_tres_selos_verdes(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    resposta = await cliente.get(f"/api/v1/certificados/verificar/{cert['codigo']}")
    corpo = resposta.json()
    assert resposta.status_code == 200
    assert corpo["valido"] is True
    assert corpo["desfecho"] == "valido"
    assert corpo["titulo"] == "Certificado válido"
    assert corpo["selos"] == {"existe": True, "naoRevogado": True,
                              "assinaturaConfere": True}
    assert "4 horas" in corpo["mensagem"]
    assert "ONG Verde Vida" in corpo["mensagem"]


async def test_verificacao_nao_exige_login(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    resposta = await cliente.get(f"/api/v1/certificados/verificar/{cert['codigo']}",
                                 headers={})
    assert resposta.status_code == 200


async def test_codigo_em_maiusculas_e_com_espacos_funciona(cliente, sessao):
    """O código vem digitado por gente: tolerar caixa e espaço sobra."""
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    resposta = await cliente.get(
        f"/api/v1/certificados/verificar/%20{cert['codigo'].upper()}%20")
    assert resposta.json()["desfecho"] == "valido"


async def test_inexistente_e_404_mas_com_corpo_de_verificacao(cliente):
    """RN-56 — não é tela de erro genérica: vem título e mensagem próprios."""
    resposta = await cliente.get("/api/v1/certificados/verificar/0000000000000000")
    corpo = resposta.json()
    assert resposta.status_code == 404
    assert corpo["desfecho"] == "inexistente"
    assert corpo["titulo"] == "Certificado não encontrado"
    assert "16 caracteres" in corpo["mensagem"]
    assert "codigo" not in corpo  # não é o formato de erro da API


@pytest.mark.parametrize("campo,valor", [
    ("horas", 40),
    ("nome_no_certificado", "Outra Pessoa"),
    ("nome_organizacao", "ONG Fantasma"),
    ("titulo_atividade", "Atividade inventada"),
    ("data_atividade", date(2020, 1, 1)),
])
async def test_escrita_direta_no_banco_e_acusada(cliente, sessao, campo, valor):
    """
    O cenário que a assinatura existe para pegar (FV-01 E3).

    Cada campo exibido na verificação, alterado direto no banco, precisa
    derrubar a assinatura — inclusive organização e data da atividade.
    """
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    await sessao.execute(
        update(Certificado).where(Certificado.id == uuid.UUID(cert["id"]))
        .values(**{campo: valor}))
    await sessao.commit()
    sessao.expire_all()

    corpo = (await cliente.get(
        f"/api/v1/certificados/verificar/{cert['codigo']}")).json()
    assert corpo["desfecho"] == "adulterado"
    assert corpo["valido"] is False
    assert corpo["selos"]["assinaturaConfere"] is False
    assert corpo["selos"]["existe"] is True
    assert "Não aceite este documento" in corpo["mensagem"]


async def test_certificado_forjado_inteiro_e_acusado(cliente, sessao):
    """O invasor insere um certificado do zero, sem a chave privada."""
    ciclo = await _ciclo(cliente, sessao)
    real = await _certificado_do(cliente, ciclo["alunos"][0][0])
    gravado = await sessao.get(Certificado, uuid.UUID(real["id"]))

    await sessao.execute(
        update(Certificado).where(Certificado.id == gravado.id)
        .values(codigo_verificacao="abcdefabcdefabcd", horas=200,
                assinatura="Zm9yamFkbw=="))
    await sessao.commit()

    corpo = (await cliente.get(
        "/api/v1/certificados/verificar/abcdefabcdefabcd")).json()
    assert corpo["desfecho"] == "adulterado"


async def test_adulteracao_vai_para_a_auditoria(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    await sessao.execute(update(Certificado)
                         .where(Certificado.id == uuid.UUID(cert["id"]))
                         .values(horas=99))
    await sessao.commit()

    await cliente.get(f"/api/v1/certificados/verificar/{cert['codigo']}")

    registro = await sessao.scalar(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "integridade.verificada"))
    assert registro is not None
    assert registro.depois["desfecho"] == "adulterado"


async def test_verificacao_valida_nao_polui_a_auditoria(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    for _ in range(3):
        await cliente.get(f"/api/v1/certificados/verificar/{cert['codigo']}")

    registros = (await sessao.scalars(
        select(RegistroAuditoria)
        .where(RegistroAuditoria.acao == "integridade.verificada"))).all()
    assert registros == []


async def test_ong_renomeada_nao_invalida_certificado_antigo(cliente, sessao):
    """
    Os campos são congelados na emissão. Se viessem de junção, trocar o nome
    da ONG faria todo certificado antigo acusar adulteração.
    """
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    await cliente.put("/api/v1/perfil", headers=_como(ciclo["ong"]),
                      json={"nome_organizacao": "Nome Novo da ONG"})

    corpo = (await cliente.get(
        f"/api/v1/certificados/verificar/{cert['codigo']}")).json()
    assert corpo["desfecho"] == "valido"
    assert corpo["certificado"]["organizacao"] == "ONG Verde Vida"


async def test_verificacao_tem_limite_por_ip(cliente, sessao, monkeypatch):
    """RN-52 — sem limite, a rota pública serviria para varrer códigos."""
    monkeypatch.setattr(config, "verificacao_por_minuto", 3)

    respostas = [
        (await cliente.get("/api/v1/certificados/verificar/0000000000000000"))
        .status_code for _ in range(5)]
    assert respostas[:3] == [404, 404, 404]
    assert respostas[3] == 429


# ===================== Revogação =====================


async def test_revogado_mostra_quando_e_por_que(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    admin = await _admin(sessao)

    resposta = await cliente.post(
        f"/api/v1/admin/certificados/{cert['id']}/revogar",
        json={"motivo": "Presença contestada pela ONG"}, headers=_como(admin))
    assert resposta.status_code == 200

    corpo = (await cliente.get(
        f"/api/v1/certificados/verificar/{cert['codigo']}")).json()
    assert corpo["desfecho"] == "revogado"
    assert corpo["valido"] is False
    assert "Presença contestada pela ONG" in corpo["mensagem"]
    # Revogar não mexe nos campos assinados: continua distinguível de adulterado.
    assert corpo["selos"] == {"existe": True, "naoRevogado": False,
                              "assinaturaConfere": True}


async def test_revogar_exige_motivo(cliente, sessao):
    """RN-34."""
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    admin = await _admin(sessao)

    resposta = await cliente.post(
        f"/api/v1/admin/certificados/{cert['id']}/revogar",
        json={"motivo": "  "}, headers=_como(admin))
    assert resposta.status_code == 400


async def test_so_admin_revoga(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    for token in (ciclo["ong"], ciclo["alunos"][0][0]):
        resposta = await cliente.post(
            f"/api/v1/admin/certificados/{cert['id']}/revogar",
            json={"motivo": "Tentativa indevida"}, headers=_como(token))
        assert resposta.status_code == 403


async def test_reverter_revogacao_devolve_validade(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    admin = await _admin(sessao)
    await cliente.post(f"/api/v1/admin/certificados/{cert['id']}/revogar",
                       json={"motivo": "Engano de digitação"}, headers=_como(admin))

    resposta = await cliente.post(
        f"/api/v1/admin/certificados/{cert['id']}/reverter-revogacao",
        headers=_como(admin))
    assert resposta.status_code == 200

    corpo = (await cliente.get(
        f"/api/v1/certificados/verificar/{cert['codigo']}")).json()
    assert corpo["desfecho"] == "valido"

    acoes = {r.acao for r in (await sessao.scalars(select(RegistroAuditoria))).all()}
    assert {"certificado.revogado", "certificado.revogacao_revertida"} <= acoes


async def test_nao_revoga_duas_vezes(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    admin = await _admin(sessao)
    await cliente.post(f"/api/v1/admin/certificados/{cert['id']}/revogar",
                       json={"motivo": "Primeira vez"}, headers=_como(admin))

    resposta = await cliente.post(
        f"/api/v1/admin/certificados/{cert['id']}/revogar",
        json={"motivo": "Segunda vez"}, headers=_como(admin))
    assert resposta.status_code == 400


# ===================== PDF =====================


async def test_aluno_baixa_o_proprio_pdf(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    token = ciclo["alunos"][0][0]
    cert = await _certificado_do(cliente, token)

    resposta = await cliente.get(f"/api/v1/certificados/{cert['id']}/pdf",
                                 headers=_como(token))
    assert resposta.status_code == 200
    assert resposta.headers["content-type"] == "application/pdf"
    assert resposta.content.startswith(b"%PDF")
    assert cert["codigo"] in resposta.headers["content-disposition"]


async def test_pdf_alheio_e_404(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])
    _, intruso = await _aluno_pronto(cliente)

    resposta = await cliente.get(f"/api/v1/certificados/{cert['id']}/pdf",
                                 headers=_como(intruso))
    assert resposta.status_code == 404


async def test_pdf_oficial_publico(cliente, sessao):
    ciclo = await _ciclo(cliente, sessao)
    cert = await _certificado_do(cliente, ciclo["alunos"][0][0])

    resposta = await cliente.get(
        f"/api/v1/certificados/verificar/{cert['codigo']}/pdf")
    assert resposta.status_code == 200
    assert resposta.content.startswith(b"%PDF")


async def test_pdf_de_registro_adulterado_nao_sai(cliente, sessao):
    """Imprimir o registro adulterado com o timbre daria ao invasor o que ele quer."""
    ciclo = await _ciclo(cliente, sessao)
    token = ciclo["alunos"][0][0]
    cert = await _certificado_do(cliente, token)
    await sessao.execute(update(Certificado)
                         .where(Certificado.id == uuid.UUID(cert["id"]))
                         .values(horas=80))
    await sessao.commit()

    for url, cabecalho in (
        (f"/api/v1/certificados/{cert['id']}/pdf", _como(token)),
        (f"/api/v1/certificados/verificar/{cert['codigo']}/pdf", {}),
    ):
        resposta = await cliente.get(url, headers=cabecalho)
        assert resposta.status_code == 409, url
        assert resposta.json()["codigo"] == "certificado_nao_confere"


async def test_revogado_tem_pdf_para_o_aluno_mas_nao_oficial(cliente, sessao):
    """FE-07 E2 — o aluno mantém o arquivo, marcado; a fonte pública não o endossa."""
    ciclo = await _ciclo(cliente, sessao)
    token = ciclo["alunos"][0][0]
    cert = await _certificado_do(cliente, token)
    admin = await _admin(sessao)
    await cliente.post(f"/api/v1/admin/certificados/{cert['id']}/revogar",
                       json={"motivo": "Presença contestada"}, headers=_como(admin))

    do_aluno = await cliente.get(f"/api/v1/certificados/{cert['id']}/pdf",
                                 headers=_como(token))
    oficial = await cliente.get(
        f"/api/v1/certificados/verificar/{cert['codigo']}/pdf")
    assert do_aluno.status_code == 200
    assert oficial.status_code == 409


async def test_pdf_publico_de_codigo_inexistente(cliente):
    resposta = await cliente.get(
        "/api/v1/certificados/verificar/ffffffffffffffff/pdf")
    assert resposta.status_code == 404


async def test_rota_de_verificacao_nao_colide_com_pdf(cliente):
    """`/verificar/pdf` é um código (inexistente), não o id de um certificado."""
    resposta = await cliente.get("/api/v1/certificados/verificar/pdf")
    assert resposta.status_code == 404
    assert resposta.json()["desfecho"] == "inexistente"
