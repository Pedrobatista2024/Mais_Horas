"""
Testes de notificação — FE-10 de docs/fluxos.md e D16.

Além de "o aviso chega", importa o que ele **não** diz: a recusa vem sem motivo
(D8) e o cancelamento não repete o motivo que a ONG escreveu para a auditoria
(D10).
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core import rate_limit, security
from app.core.config import config
from app.db.models import Atividade, Notificacao, Usuario
from app.db.session import obter_sessao
from app.main import app
from app.services import notificacao_service

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


async def _aluno_pronto(cliente) -> tuple[str, str]:
    aluno_id, token = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(token), json={
        "nome_completo": "Maria da Silva Souza", "instituicao": "UniC",
        "curso": "Sistemas de Informação",
    })
    return aluno_id, token


async def _atividade(cliente, ong: str, **extra) -> str:
    dados = {
        "titulo": "Mutirão de limpeza", "descricao": "Limpeza da praia.",
        "local": "Praia do Futuro",
        "data": (date.today() + timedelta(days=1)).isoformat(),
        "hora_inicio": "08:00", "hora_fim": "12:00", "vagas_max": 20,
    }
    dados.update(extra)
    atividade_id = (await cliente.post("/api/v1/atividades", headers=_como(ong),
                                       json=dados)).json()["id"]
    await cliente.post(f"/api/v1/atividades/{atividade_id}/publicar",
                       headers=_como(ong))
    return atividade_id


async def _inscrever(cliente, token: str, atividade_id: str) -> str:
    resposta = await cliente.post("/api/v1/inscricoes", headers=_como(token),
                                  json={"atividadeId": atividade_id})
    return resposta.json()["id"]


async def _avisos(cliente, token: str, **params) -> dict:
    return (await cliente.get("/api/v1/notificacoes", headers=_como(token),
                              params=params)).json()


async def _contador(cliente, token: str) -> int:
    return (await cliente.get("/api/v1/notificacoes/contador",
                              headers=_como(token))).json()["naoLidas"]


async def _finalizar(cliente, sessao, ong: str, atividade_id: str,
                     decisoes: dict[str, str]):
    gravada = await sessao.get(Atividade, uuid.UUID(atividade_id))
    gravada.data = date.today() - timedelta(days=1)
    await sessao.commit()
    await cliente.put(f"/api/v1/atividades/{atividade_id}/presencas",
                      headers=_como(ong), json={"decisoes": [
                          {"inscricaoId": i, "situacao": s}
                          for i, s in decisoes.items()]})
    return await cliente.post(f"/api/v1/atividades/{atividade_id}/finalizar",
                              headers=_como(ong))


# ===================== Origem dos avisos =====================


async def test_aprovacao_avisa_o_aluno(cliente):
    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong, exige_aprovacao=True)
    _, aluno = await _aluno_pronto(cliente)
    inscricao = await _inscrever(cliente, aluno, atividade_id)
    assert await _contador(cliente, aluno) == 0

    await cliente.post(f"/api/v1/inscricoes/{inscricao}/aprovar", headers=_como(ong))

    corpo = await _avisos(cliente, aluno)
    assert corpo["total"] == 1
    aviso = corpo["itens"][0]
    assert aviso["tipo"] == "inscricao.aprovada"
    assert "Mutirão de limpeza" in aviso["mensagem"]
    assert aviso["link"] == "/minhas-inscricoes"
    assert aviso["lida"] is False
    assert await _contador(cliente, aluno) == 1


async def test_recusa_avisa_sem_motivo(cliente):
    """D8 — o aluno fica sabendo, mas nada no texto sugere um porquê."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong, exige_aprovacao=True)
    _, aluno = await _aluno_pronto(cliente)
    inscricao = await _inscrever(cliente, aluno, atividade_id)

    await cliente.post(f"/api/v1/inscricoes/{inscricao}/recusar", headers=_como(ong))

    aviso = (await _avisos(cliente, aluno))["itens"][0]
    assert aviso["tipo"] == "inscricao.recusada"
    assert aviso["titulo"] == "Inscrição não aprovada"
    assert "motivo" not in aviso["mensagem"].lower()


async def test_cancelamento_avisa_os_inscritos_sem_o_motivo(cliente):
    """D10 — o motivo escrito pela ONG é da auditoria, não do aluno."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    alunos = []
    for _ in range(2):
        _, token = await _aluno_pronto(cliente)
        await _inscrever(cliente, token, atividade_id)
        alunos.append(token)

    await cliente.post(f"/api/v1/atividades/{atividade_id}/cancelar",
                       headers=_como(ong),
                       json={"motivo": "Coordenador brigou com o voluntário"})

    for token in alunos:
        aviso = (await _avisos(cliente, token))["itens"][0]
        assert aviso["tipo"] == "atividade.cancelada"
        assert "brigou" not in aviso["mensagem"]


async def test_quem_ja_tinha_desistido_nao_e_avisado(cliente):
    """O cancelamento só alcança inscrições ativas; quem saiu antes não se importa."""
    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    _, aluno = await _aluno_pronto(cliente)
    inscricao = await _inscrever(cliente, aluno, atividade_id)
    await cliente.post(f"/api/v1/inscricoes/{inscricao}/cancelar",
                       headers=_como(aluno))

    await cliente.post(f"/api/v1/atividades/{atividade_id}/cancelar",
                       headers=_como(ong), json={})

    assert (await _avisos(cliente, aluno))["total"] == 0


async def test_emissao_avisa_so_os_presentes(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    _, presente = await _aluno_pronto(cliente)
    _, ausente = await _aluno_pronto(cliente)
    i_presente = await _inscrever(cliente, presente, atividade_id)
    i_ausente = await _inscrever(cliente, ausente, atividade_id)

    resposta = await _finalizar(cliente, sessao, ong, atividade_id,
                                {i_presente: "presente", i_ausente: "ausente"})
    assert resposta.status_code == 200, resposta.text

    aviso = (await _avisos(cliente, presente))["itens"][0]
    assert aviso["tipo"] == "certificado.emitido"
    assert "4 horas" in aviso["mensagem"]
    assert aviso["link"] == "/meus-certificados"
    assert (await _avisos(cliente, ausente))["total"] == 0


async def test_emissao_que_falha_nao_deixa_aviso(cliente, sessao, monkeypatch):
    """
    O aviso vive na mesma transação da emissão: se ela cai, ele cai junto.

    A atividade precisa continuar existindo — senão "nenhum aviso" seria
    verdade só porque o rollback apagou tudo.
    """
    original = security.assinar_certificado
    chamadas = {"n": 0}

    def quebrar_na_segunda(texto):
        chamadas["n"] += 1
        if chamadas["n"] == 2:
            raise RuntimeError("falha simulada")
        return original(texto)

    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    inscricoes = {}
    for _ in range(2):
        _, token = await _aluno_pronto(cliente)
        inscricoes[await _inscrever(cliente, token, atividade_id)] = "presente"

    monkeypatch.setattr(security, "assinar_certificado", quebrar_na_segunda)
    with pytest.raises(RuntimeError):
        await _finalizar(cliente, sessao, ong, atividade_id, inscricoes)
    await sessao.rollback()

    atividade = await sessao.get(Atividade, uuid.UUID(atividade_id))
    assert atividade is not None
    assert atividade.situacao == "publicada"
    emitidos = (await sessao.scalars(
        select(Notificacao).where(Notificacao.tipo == "certificado.emitido"))).all()
    assert emitidos == []


async def test_revogar_e_restabelecer_avisam(cliente, sessao):
    _, ong = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    _, aluno = await _aluno_pronto(cliente)
    inscricao = await _inscrever(cliente, aluno, atividade_id)
    await _finalizar(cliente, sessao, ong, atividade_id, {inscricao: "presente"})
    cert_id = (await cliente.get("/api/v1/certificados/meus",
                                 headers=_como(aluno))).json()["itens"][0]["id"]

    admin = Usuario(nome="Admin", email=f"{uuid.uuid4().hex[:8]}@admin.com",
                    senha_hash=security.gerar_hash_senha(SENHA), papel="superadmin")
    sessao.add(admin)
    await sessao.commit()
    token_admin, _ = security.criar_access_token(admin.id, admin.papel)

    await cliente.post(f"/api/v1/admin/certificados/{cert_id}/revogar",
                       headers=_como(token_admin),
                       json={"motivo": "Presença contestada"})
    await cliente.post(f"/api/v1/admin/certificados/{cert_id}/reverter-revogacao",
                       headers=_como(token_admin))

    tipos = [a["tipo"] for a in (await _avisos(cliente, aluno))["itens"]]
    assert tipos[:2] == ["certificado.restabelecido", "certificado.revogado"]
    revogado = (await _avisos(cliente, aluno))["itens"][1]
    assert "Presença contestada" in revogado["mensagem"]


# ===================== Leitura =====================


async def _criar_avisos(sessao, usuario_id: str, quantos: int) -> None:
    for indice in range(quantos):
        await notificacao_service.notificar(
            sessao, uuid.UUID(usuario_id), "inscricao.aprovada",
            f"Aviso {indice}", "texto", "/minhas-inscricoes")
    await sessao.commit()


async def test_marcar_uma_como_lida(cliente, sessao):
    aluno_id, aluno = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, aluno_id, 2)
    aviso = (await _avisos(cliente, aluno))["itens"][0]

    resposta = await cliente.post(f"/api/v1/notificacoes/{aviso['id']}/lida",
                                  headers=_como(aluno))
    assert resposta.status_code == 200
    assert resposta.json()["lida"] is True
    assert await _contador(cliente, aluno) == 1


async def test_marcar_de_novo_nao_muda_nada(cliente, sessao):
    aluno_id, aluno = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, aluno_id, 1)
    aviso = (await _avisos(cliente, aluno))["itens"][0]
    for _ in range(2):
        resposta = await cliente.post(f"/api/v1/notificacoes/{aviso['id']}/lida",
                                      headers=_como(aluno))
        assert resposta.status_code == 200


async def test_marcar_todas_zera_o_contador(cliente, sessao):
    aluno_id, aluno = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, aluno_id, 3)

    resposta = await cliente.post("/api/v1/notificacoes/lidas", headers=_como(aluno))
    assert resposta.json()["marcadas"] == 3
    assert await _contador(cliente, aluno) == 0


async def test_marcar_todas_nao_toca_nos_avisos_de_outro(cliente, sessao):
    um_id, um = await _aluno_pronto(cliente)
    outro_id, outro = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, um_id, 2)
    await _criar_avisos(sessao, outro_id, 2)

    await cliente.post("/api/v1/notificacoes/lidas", headers=_como(um))
    assert await _contador(cliente, outro) == 2


async def test_filtro_apenas_nao_lidas(cliente, sessao):
    aluno_id, aluno = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, aluno_id, 3)
    primeiro = (await _avisos(cliente, aluno))["itens"][0]
    await cliente.post(f"/api/v1/notificacoes/{primeiro['id']}/lida",
                       headers=_como(aluno))

    corpo = await _avisos(cliente, aluno, apenasNaoLidas="true")
    assert corpo["total"] == 2
    assert all(not a["lida"] for a in corpo["itens"])


async def test_aviso_alheio_e_404(cliente, sessao):
    dono_id, _ = await _aluno_pronto(cliente)
    _, intruso = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, dono_id, 1)
    aviso = await sessao.scalar(
        select(Notificacao).where(Notificacao.destinatario_id == uuid.UUID(dono_id)))

    resposta = await cliente.post(f"/api/v1/notificacoes/{aviso.id}/lida",
                                  headers=_como(intruso))
    assert resposta.status_code == 404
    await sessao.refresh(aviso)
    assert aviso.lida_em is None


async def test_lista_nao_mostra_avisos_de_outro(cliente, sessao):
    dono_id, _ = await _aluno_pronto(cliente)
    _, outro = await _aluno_pronto(cliente)
    await _criar_avisos(sessao, dono_id, 2)
    assert (await _avisos(cliente, outro))["total"] == 0


async def test_ong_tambem_tem_sino(cliente):
    """O sino fica no cabeçalho de qualquer papel, mesmo sem avisos ainda."""
    _, ong = await _cadastrar(cliente, "ong")
    assert await _contador(cliente, ong) == 0


async def test_contador_exige_login(cliente):
    resposta = await cliente.get("/api/v1/notificacoes/contador")
    assert resposta.status_code == 401


# ===================== Salvaguardas =====================


async def test_tipo_fora_do_catalogo_e_recusado(sessao):
    with pytest.raises(ValueError):
        await notificacao_service.notificar(
            sessao, uuid.uuid4(), "promocao.imperdivel", "x", "y")


@pytest.mark.parametrize("link", [
    "https://site-malicioso.com", "//site-malicioso.com", "javascript:alert(1)",
])
async def test_link_externo_e_descartado(cliente, sessao, link):
    """O frontend navega para o link; aceitar externo viraria redirecionamento aberto."""
    aluno_id, aluno = await _aluno_pronto(cliente)
    await notificacao_service.notificar(
        sessao, uuid.UUID(aluno_id), "inscricao.aprovada", "x", "y", link)
    await sessao.commit()

    aviso = (await _avisos(cliente, aluno))["itens"][0]
    assert aviso["link"] is None
