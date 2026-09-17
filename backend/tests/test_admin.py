"""
Testes do console administrativo — FS-02 a FS-11 de docs/fluxos.md.

Além do que o admin pode fazer, importa o que ele **não** pode: definir senha,
trocar e-mail, emitir certificado, apagar auditoria, suspender a si mesmo ou
o último admin.
"""

from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update

from app.core import rate_limit, security
from app.core.config import config
from app.db.models import (
    Atividade, Certificado, Inscricao, Notificacao, RegistroAuditoria,
    TokenRedefinicaoSenha, TokenSessao, Usuario,
)
from app.db.session import obter_sessao
from app.main import app

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


async def _cadastrar(cliente, papel: str, nome: str | None = None,
                     email: str | None = None) -> tuple[str, str, str]:
    email = email or f"{uuid.uuid4().hex[:12]}@teste.com"
    resposta = await cliente.post("/api/v1/auth/cadastro", json={
        "nome": nome or ("ONG Verde Vida" if papel == "ong" else "Maria Silva"),
        "email": email, "senha": SENHA, "papel": papel,
    })
    corpo = resposta.json()
    return corpo["usuario"]["id"], corpo["token"], email


async def _admin(sessao, email: str | None = None) -> tuple[Usuario, str]:
    admin = Usuario(nome="Admin Geral",
                    email=email or f"{uuid.uuid4().hex[:10]}@admin.com",
                    senha_hash=security.gerar_hash_senha(SENHA), papel="superadmin")
    sessao.add(admin)
    await sessao.commit()
    token, _ = security.criar_access_token(admin.id, admin.papel)
    return admin, token


async def _aluno_pronto(cliente) -> tuple[str, str]:
    aluno_id, token, _ = await _cadastrar(cliente, "estudante")
    await cliente.put("/api/v1/perfil", headers=_como(token), json={
        "nome_completo": "Maria da Silva Souza", "instituicao": "UniC",
        "curso": "Sistemas de Informação"})
    return aluno_id, token


async def _atividade(cliente, ong: str, **extra) -> str:
    dados = {"titulo": "Mutirão de limpeza", "descricao": "Limpeza da praia.",
             "local": "Praia do Futuro",
             "data": (date.today() + timedelta(days=2)).isoformat(),
             "hora_inicio": "08:00", "hora_fim": "12:00", "vagas_max": 20}
    dados.update(extra)
    atividade_id = (await cliente.post("/api/v1/atividades", headers=_como(ong),
                                       json=dados)).json()["id"]
    await cliente.post(f"/api/v1/atividades/{atividade_id}/publicar",
                       headers=_como(ong))
    return atividade_id


async def _inscrever(cliente, token: str, atividade_id: str) -> str:
    return (await cliente.post("/api/v1/inscricoes", headers=_como(token),
                               json={"atividadeId": atividade_id})).json()["id"]


async def _mover(sessao, atividade_id: str, *, dias: int, inicio="08:00",
                 fim="12:00") -> None:
    """Desloca a atividade no calendário: `dias` negativo é passado."""
    await sessao.execute(
        update(Atividade).where(Atividade.id == uuid.UUID(atividade_id))
        .values(data=date.today() + timedelta(days=dias),
                hora_inicio=time.fromisoformat(inicio),
                hora_fim=time.fromisoformat(fim)))
    await sessao.commit()
    sessao.expire_all()


async def _acoes(sessao, acao: str) -> list[RegistroAuditoria]:
    return list(await sessao.scalars(
        select(RegistroAuditoria).where(RegistroAuditoria.acao == acao)))


# ===================== Acesso =====================


ROTAS_DE_LEITURA = [
    "/api/v1/admin/visao-geral", "/api/v1/admin/auditoria",
    "/api/v1/admin/auditoria/exportar", "/api/v1/admin/usuarios",
    "/api/v1/admin/ongs", "/api/v1/admin/atividades",
    "/api/v1/admin/certificados", "/api/v1/admin/sistema",
    "/api/v1/admin/sistema/chave-publica",
]


@pytest.mark.parametrize("rota", ROTAS_DE_LEITURA)
async def test_so_admin_entra_no_console(cliente, rota):
    for papel in ("estudante", "ong"):
        _, token, _ = await _cadastrar(cliente, papel)
        resposta = await cliente.get(rota, headers=_como(token))
        assert resposta.status_code == 403, (papel, rota)
    assert (await cliente.get(rota)).status_code == 401


async def test_nao_existe_rota_para_alterar_auditoria(cliente, sessao):
    """RN-33 — a ausência é a garantia."""
    _, admin = await _admin(sessao)
    for metodo in ("PUT", "DELETE", "PATCH"):
        resposta = await cliente.request(metodo, "/api/v1/admin/auditoria",
                                         headers=_como(admin))
        assert resposta.status_code in (404, 405), metodo


async def test_nao_existe_rota_para_definir_senha_nem_emitir(cliente, sessao):
    """RN-28 e D14."""
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")
    tentativas = [
        ("POST", f"/api/v1/admin/usuarios/{usuario_id}/senha"),
        ("PUT", f"/api/v1/admin/usuarios/{usuario_id}"),
        ("POST", "/api/v1/admin/certificados"),
    ]
    for metodo, rota in tentativas:
        resposta = await cliente.request(metodo, rota, headers=_como(admin),
                                         json={"senha": "x", "email": "y@z.com"})
        assert resposta.status_code in (404, 405), rota


# ===================== Visão geral (A1) =====================


async def test_visao_geral_conta_e_alerta_atividade_parada(cliente, sessao):
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    await _mover(sessao, atividade_id, dias=-10)

    corpo = (await cliente.get("/api/v1/admin/visao-geral",
                               headers=_como(admin))).json()
    assert corpo["contas"]["porPapel"]["ong"] >= 1
    assert corpo["atividades"]["aguardando_validacao"] == 1
    tipos = {a["tipo"] for a in corpo["alertas"]}
    assert "atividades_paradas" in tipos
    assert "ong_sem_cnpj" in tipos
    assert corpo["saude"]["banco"] is True


async def test_visao_geral_alerta_certificado_adulterado(cliente, sessao):
    _, admin = await _admin(sessao)
    sessao.add(RegistroAuditoria(acao="integridade.verificada",
                                 depois={"desfecho": "adulterado"}))
    await sessao.commit()

    corpo = (await cliente.get("/api/v1/admin/visao-geral",
                               headers=_como(admin))).json()
    alerta = next(a for a in corpo["alertas"] if a["tipo"] == "certificado_adulterado")
    assert alerta["gravidade"] == "critica"


# ===================== Auditoria (A2) =====================


async def test_auditoria_lista_e_filtra_por_acao(cliente, sessao):
    admin_usuario, admin = await _admin(sessao)
    await _cadastrar(cliente, "estudante")

    corpo = (await cliente.get("/api/v1/admin/auditoria",
                               params={"acao": "conta.criada"},
                               headers=_como(admin))).json()
    assert corpo["total"] >= 1
    assert all(r["acao"] == "conta.criada" for r in corpo["itens"])


async def test_auditoria_filtra_familia_de_acoes(cliente, sessao):
    _, admin = await _admin(sessao)
    _, aluno, email = await _cadastrar(cliente, "estudante")
    await cliente.post("/api/v1/auth/entrar", json={"email": email, "senha": "errada"})

    corpo = (await cliente.get("/api/v1/admin/auditoria",
                               params={"acao": "sessao."},
                               headers=_como(admin))).json()
    assert corpo["itens"]
    assert all(r["acao"].startswith("sessao.") for r in corpo["itens"])


async def test_consultar_auditoria_e_auditado(cliente, sessao):
    """FS-02 — e só na primeira página, para paginar não parecer nova consulta."""
    admin_usuario, admin = await _admin(sessao)
    await cliente.get("/api/v1/admin/auditoria", headers=_como(admin))
    await cliente.get("/api/v1/admin/auditoria", params={"pagina": 2},
                      headers=_como(admin))

    registros = await _acoes(sessao, "auditoria.consultada")
    assert len(registros) == 1
    assert registros[0].ator_id == admin_usuario.id


async def test_filtro_apenas_admin(cliente, sessao):
    _, admin = await _admin(sessao)
    await _cadastrar(cliente, "estudante")
    await cliente.get("/api/v1/admin/auditoria", headers=_como(admin))

    corpo = (await cliente.get("/api/v1/admin/auditoria",
                               params={"apenasAdmin": "true"},
                               headers=_como(admin))).json()
    assert corpo["itens"]
    assert all(r["atorPapel"] == "superadmin" for r in corpo["itens"])


async def test_auditoria_mostra_nome_do_ator(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante", nome="Joana Prado")

    corpo = (await cliente.get("/api/v1/admin/auditoria",
                               params={"atorId": usuario_id},
                               headers=_como(admin))).json()
    assert corpo["itens"][0]["atorNome"] == "Joana Prado"


async def test_exportar_csv_com_filtro(cliente, sessao):
    _, admin = await _admin(sessao)
    await _cadastrar(cliente, "estudante")

    resposta = await cliente.get("/api/v1/admin/auditoria/exportar",
                                 params={"acao": "conta.criada"},
                                 headers=_como(admin))
    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/csv")
    linhas = list(csv.reader(io.StringIO(resposta.content.decode("utf-8-sig")),
                             delimiter=";"))
    assert linhas[0][:2] == ["ocorrido_em", "acao"]
    assert all(linha[1] == "conta.criada" for linha in linhas[1:])
    assert len(await _acoes(sessao, "auditoria.exportada")) == 1


async def test_csv_neutraliza_formula(cliente, sessao):
    """Um nome começando com '=' viraria fórmula ao abrir na planilha."""
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante",
                                        nome='=HYPERLINK("http://mal.com")')

    resposta = await cliente.get("/api/v1/admin/auditoria/exportar",
                                 params={"atorId": usuario_id},
                                 headers=_como(admin))
    linhas = list(csv.reader(io.StringIO(resposta.content.decode("utf-8-sig")),
                             delimiter=";"))
    ator = linhas[1][2]
    assert ator.startswith("'=")


# ===================== Usuários (A3, A4) =====================


async def test_lista_usuarios_com_filtro_e_busca(cliente, sessao):
    _, admin = await _admin(sessao)
    await _cadastrar(cliente, "ong", nome="Instituto Maré")
    await _cadastrar(cliente, "estudante", nome="Pedro Batista")

    ongs = (await cliente.get("/api/v1/admin/usuarios", params={"papel": "ong"},
                              headers=_como(admin))).json()
    assert ongs["itens"] and all(u["papel"] == "ong" for u in ongs["itens"])

    busca = (await cliente.get("/api/v1/admin/usuarios", params={"busca": "batista"},
                               headers=_como(admin))).json()
    assert [u["nome"] for u in busca["itens"]] == ["Pedro Batista"]


async def test_detalhe_mostra_sessoes_e_e_auditado(cliente, sessao):
    """RN-32 — ler dado pessoal também fica na trilha."""
    admin_usuario, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")

    corpo = (await cliente.get(f"/api/v1/admin/usuarios/{usuario_id}",
                               headers=_como(admin))).json()
    assert len(corpo["sessoesAtivas"]) == 1
    assert corpo["ultimoAcesso"] is not None
    registro = (await _acoes(sessao, "usuario.consultado"))[0]
    assert str(registro.entidade_id) == usuario_id
    assert registro.ator_id == admin_usuario.id


async def test_detalhe_nao_expoe_senha(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")
    corpo = (await cliente.get(f"/api/v1/admin/usuarios/{usuario_id}",
                               headers=_como(admin))).text
    assert "senha" not in corpo.lower()
    assert "argon2" not in corpo.lower()


async def test_redefinir_senha_dispara_link_sem_mostrar_senha(cliente, sessao):
    """FS-03 / D12 — o admin nunca vê nem escolhe a senha."""
    admin_usuario, admin = await _admin(sessao)
    usuario_id, _, email = await _cadastrar(cliente, "estudante")

    resposta = await cliente.post(
        f"/api/v1/admin/usuarios/{usuario_id}/redefinir-senha", headers=_como(admin))
    assert resposta.status_code == 200
    assert resposta.json() == {"enviadoPara": email}

    link = await sessao.scalar(select(TokenRedefinicaoSenha).where(
        TokenRedefinicaoSenha.usuario_id == uuid.UUID(usuario_id)))
    assert link.disparado_por == admin_usuario.id


async def test_suspender_derruba_acesso_e_sessoes(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, token, email = await _cadastrar(cliente, "estudante")

    resposta = await cliente.post(
        f"/api/v1/admin/usuarios/{usuario_id}/suspender",
        json={"motivo": "Conduta imprópria no evento"}, headers=_como(admin))
    assert resposta.status_code == 200
    assert resposta.json()["situacao"] == "suspensa"

    # O access token ainda válido deixa de servir…
    assert (await cliente.get("/api/v1/perfil", headers=_como(token))).status_code == 403
    # …o login é recusado…
    entrar = await cliente.post("/api/v1/auth/entrar",
                                json={"email": email, "senha": SENHA})
    assert entrar.status_code == 403
    # …e nenhuma sessão fica viva.
    vivas = (await sessao.scalars(select(TokenSessao).where(
        TokenSessao.usuario_id == uuid.UUID(usuario_id),
        TokenSessao.revogado_em.is_(None)))).all()
    assert vivas == []


async def test_redefinir_senha_de_suspenso_e_recusado(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")
    await cliente.post(f"/api/v1/admin/usuarios/{usuario_id}/suspender",
                       json={"motivo": "Motivo qualquer"}, headers=_como(admin))

    resposta = await cliente.post(
        f"/api/v1/admin/usuarios/{usuario_id}/redefinir-senha", headers=_como(admin))
    assert resposta.status_code == 400


async def test_suspender_exige_motivo(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")
    resposta = await cliente.post(f"/api/v1/admin/usuarios/{usuario_id}/suspender",
                                  json={"motivo": ""}, headers=_como(admin))
    assert resposta.status_code == 400


async def test_admin_nao_suspende_a_si_mesmo(cliente, sessao):
    admin_usuario, admin = await _admin(sessao)
    await _admin(sessao)  # há outro admin: o bloqueio é por ser ele mesmo
    resposta = await cliente.post(
        f"/api/v1/admin/usuarios/{admin_usuario.id}/suspender",
        json={"motivo": "Teste de autossuspensão"}, headers=_como(admin))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "nao_pode_suspender_a_si_mesmo"


async def test_ultimo_admin_ativo_nunca_e_suspenso(sessao):
    """
    RN-44. Pela API a trava não chega a disparar — quem suspende é sempre um
    admin ativo e não pode suspender a si mesmo —, então ela é defesa em
    profundidade, e o teste vai direto ao serviço com um ator que já não
    conta como ativo.
    """
    from app.core.errors import ErroDeNegocio
    from app.services import admin_contas_service

    ator, _ = await _admin(sessao)
    unico, _ = await _admin(sessao)
    ator.situacao = "suspensa"
    ator.suspenso_em = datetime.now(timezone.utc)
    ator.motivo_suspensao = "sessão antiga ainda aberta"
    await sessao.commit()

    with pytest.raises(ErroDeNegocio) as erro:
        await admin_contas_service.suspender(sessao, ator, unico.id, "Qualquer motivo")
    assert erro.value.codigo == "ultimo_admin_ativo"
    await sessao.refresh(unico)
    assert unico.situacao == "ativa"


async def test_admin_suspende_outro_admin_quando_sobra_alguem(cliente, sessao):
    _, token = await _admin(sessao)
    outro, _ = await _admin(sessao)
    resposta = await cliente.post(f"/api/v1/admin/usuarios/{outro.id}/suspender",
                                  json={"motivo": "Saiu da equipe"},
                                  headers=_como(token))
    assert resposta.status_code == 200


async def test_reativar_devolve_o_acesso(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, _, email = await _cadastrar(cliente, "estudante")
    await cliente.post(f"/api/v1/admin/usuarios/{usuario_id}/suspender",
                       json={"motivo": "Suspensão temporária"}, headers=_como(admin))

    resposta = await cliente.post(f"/api/v1/admin/usuarios/{usuario_id}/reativar",
                                  headers=_como(admin))
    assert resposta.json()["situacao"] == "ativa"
    entrar = await cliente.post("/api/v1/auth/entrar",
                                json={"email": email, "senha": SENHA})
    assert entrar.status_code == 200


async def test_suspender_ong_cancela_futuras_e_avisa_inscritos(cliente, sessao):
    """RN-51 — e reativar não reabre: os inscritos já foram liberados."""
    _, admin = await _admin(sessao)
    ong_id, ong, _ = await _cadastrar(cliente, "ong")
    futura = await _atividade(cliente, ong, titulo="Plantio futuro")
    aluno_id, aluno = await _aluno_pronto(cliente)
    await _inscrever(cliente, aluno, futura)

    resposta = await cliente.post(f"/api/v1/admin/usuarios/{ong_id}/suspender",
                                  json={"motivo": "CNPJ inválido"},
                                  headers=_como(admin))
    assert resposta.json()["atividadesCanceladas"] == 1

    atividade = await sessao.get(Atividade, uuid.UUID(futura))
    await sessao.refresh(atividade)
    assert atividade.situacao == "cancelada"
    aviso = await sessao.scalar(select(Notificacao).where(
        Notificacao.destinatario_id == uuid.UUID(aluno_id)))
    assert aviso.tipo == "atividade.cancelada"
    assert "CNPJ" not in aviso.mensagem  # o motivo é da auditoria (D10)

    await cliente.post(f"/api/v1/admin/usuarios/{ong_id}/reativar",
                       headers=_como(admin))
    await sessao.refresh(atividade)
    assert atividade.situacao == "cancelada"


async def test_suspender_ong_preserva_atividade_ja_iniciada(cliente, sessao):
    """
    A que já começou não é cancelada — negaria o certificado de quem foi —,
    mas sai da vitrine (RN-36).
    """
    _, admin = await _admin(sessao)
    ong_id, ong, _ = await _cadastrar(cliente, "ong")
    rolando = await _atividade(cliente, ong)
    await _mover(sessao, rolando, dias=0, inicio="00:00", fim="23:59")

    await cliente.post(f"/api/v1/admin/usuarios/{ong_id}/suspender",
                       json={"motivo": "Denúncia em apuração"}, headers=_como(admin))

    atividade = await sessao.get(Atividade, uuid.UUID(rolando))
    await sessao.refresh(atividade)
    assert atividade.situacao == "publicada"
    vitrine = (await cliente.get("/api/v1/atividades")).json()
    assert all(i["id"] != rolando for i in vitrine["itens"])


async def test_encerrar_sessoes_revoga_os_refresh(cliente, sessao):
    admin_usuario, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")

    resposta = await cliente.post(
        f"/api/v1/admin/usuarios/{usuario_id}/encerrar-sessoes", headers=_como(admin))
    assert resposta.status_code == 200
    vivas = (await sessao.scalars(select(TokenSessao).where(
        TokenSessao.usuario_id == uuid.UUID(usuario_id),
        TokenSessao.revogado_em.is_(None)))).all()
    assert vivas == []
    assert len(await _acoes(sessao, "sessoes.revogadas")) == 1


async def test_criar_admin_exige_a_propria_senha(cliente, sessao):
    """RN-37."""
    _, admin = await _admin(sessao)
    resposta = await cliente.post("/api/v1/admin/administradores",
                                  headers=_como(admin), json={
                                      "nome": "Nova Admin", "email": "nova@admin.com",
                                      "senhaAtual": "senha-errada"})
    assert resposta.status_code == 403
    assert resposta.json()["codigo"] == "senha_atual_incorreta"
    assert await sessao.scalar(select(Usuario).where(
        Usuario.email == "nova@admin.com")) is None


async def test_criar_admin_nasce_sem_senha_conhecida(cliente, sessao):
    """D12 — ninguém define a senha de outra pessoa: vai o link."""
    admin_usuario, admin = await _admin(sessao)
    resposta = await cliente.post("/api/v1/admin/administradores",
                                  headers=_como(admin), json={
                                      "nome": "Nova Admin", "email": "Nova@Admin.com",
                                      "senhaAtual": SENHA})
    assert resposta.status_code == 201
    assert resposta.json()["papel"] == "superadmin"

    novo = await sessao.scalar(select(Usuario).where(Usuario.email == "nova@admin.com"))
    link = await sessao.scalar(select(TokenRedefinicaoSenha).where(
        TokenRedefinicaoSenha.usuario_id == novo.id))
    assert link is not None
    # A senha do criador não serve para entrar na conta nova.
    entrar = await cliente.post("/api/v1/auth/entrar",
                                json={"email": "nova@admin.com", "senha": SENHA})
    assert entrar.json()["codigo"] == "credenciais_invalidas"
    registro = (await _acoes(sessao, "admin.criado"))[0]
    assert registro.ator_id == admin_usuario.id


async def test_criar_admin_com_email_em_uso(cliente, sessao):
    _, admin = await _admin(sessao)
    _, _, email = await _cadastrar(cliente, "estudante")
    resposta = await cliente.post("/api/v1/admin/administradores",
                                  headers=_como(admin), json={
                                      "nome": "Duplicada", "email": email,
                                      "senhaAtual": SENHA})
    assert resposta.status_code == 409


# ===================== ONGs (A5) =====================


async def test_verificar_ong_da_o_selo(cliente, sessao):
    admin_usuario, admin = await _admin(sessao)
    ong_id, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)

    await cliente.post(f"/api/v1/admin/ongs/{ong_id}/verificar", headers=_como(admin))
    detalhe = (await cliente.get(f"/api/v1/atividades/{atividade_id}")).json()
    assert detalhe["ong"]["verificada"] is True

    await cliente.delete(f"/api/v1/admin/ongs/{ong_id}/verificar",
                         headers=_como(admin))
    detalhe = (await cliente.get(f"/api/v1/atividades/{atividade_id}")).json()
    assert detalhe["ong"]["verificada"] is False

    assert len(await _acoes(sessao, "ong.verificada")) == 1
    assert len(await _acoes(sessao, "ong.verificacao_removida")) == 1


async def test_verificar_de_novo_nao_duplica_auditoria(cliente, sessao):
    _, admin = await _admin(sessao)
    ong_id, _, _ = await _cadastrar(cliente, "ong")
    for _ in range(2):
        await cliente.post(f"/api/v1/admin/ongs/{ong_id}/verificar",
                           headers=_como(admin))
    assert len(await _acoes(sessao, "ong.verificada")) == 1


async def test_verificar_conta_que_nao_e_ong(cliente, sessao):
    _, admin = await _admin(sessao)
    aluno_id, _, _ = await _cadastrar(cliente, "estudante")
    resposta = await cliente.post(f"/api/v1/admin/ongs/{aluno_id}/verificar",
                                  headers=_como(admin))
    assert resposta.status_code == 400


async def test_lista_de_ongs_traz_numeros(cliente, sessao):
    _, admin = await _admin(sessao)
    ong_id, ong, _ = await _cadastrar(cliente, "ong", nome="Instituto Contagem")
    await _atividade(cliente, ong)

    corpo = (await cliente.get("/api/v1/admin/ongs", params={"busca": "contagem"},
                               headers=_como(admin))).json()
    item = corpo["itens"][0]
    assert item["id"] == ong_id
    assert item["atividades"] == 1
    assert item["verificada"] is False


# ===================== Atividades (A6) =====================


async def test_admin_edita_mesmo_com_inscritos_e_fica_visivel(cliente, sessao):
    """FS-07 — sem a trava da RN-12, mas marcada (RN-35)."""
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    _, aluno = await _aluno_pronto(cliente)
    await _inscrever(cliente, aluno, atividade_id)

    resposta = await cliente.put(f"/api/v1/admin/atividades/{atividade_id}",
                                 json={"local": "Praia de Iracema"},
                                 headers=_como(admin))
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["local"] == "Praia de Iracema"
    assert resposta.json()["editadaPorAdminEm"] is not None
    assert len(await _acoes(sessao, "atividade.editada_por_admin")) == 1


async def test_edicao_sem_mudanca_nao_marca_a_atividade(cliente, sessao):
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)

    resposta = await cliente.put(f"/api/v1/admin/atividades/{atividade_id}",
                                 json={"titulo": "Mutirão de limpeza"},
                                 headers=_como(admin))
    assert resposta.json()["editadaPorAdminEm"] is None


async def test_admin_respeita_vagas_abaixo_dos_inscritos(cliente, sessao):
    """FS-07 E2 — a trava de coerência vale para o admin também."""
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong, vagas_min=1)
    for _ in range(2):
        _, aluno = await _aluno_pronto(cliente)
        await _inscrever(cliente, aluno, atividade_id)

    resposta = await cliente.put(f"/api/v1/admin/atividades/{atividade_id}",
                                 json={"vagas_max": 1}, headers=_como(admin))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "vagas_abaixo_dos_inscritos"


async def test_admin_nao_edita_finalizada(cliente, sessao):
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    await sessao.execute(update(Atividade).where(
        Atividade.id == uuid.UUID(atividade_id)).values(situacao="finalizada"))
    await sessao.commit()

    resposta = await cliente.put(f"/api/v1/admin/atividades/{atividade_id}",
                                 json={"titulo": "Outra coisa"}, headers=_como(admin))
    assert resposta.status_code == 403


async def test_admin_cancela_com_motivo(cliente, sessao):
    admin_usuario, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)

    sem_motivo = await cliente.post(f"/api/v1/admin/atividades/{atividade_id}/cancelar",
                                    json={}, headers=_como(admin))
    assert sem_motivo.status_code == 400

    resposta = await cliente.post(f"/api/v1/admin/atividades/{atividade_id}/cancelar",
                                  json={"motivo": "Local interditado"},
                                  headers=_como(admin))
    assert resposta.json()["situacao"] == "cancelada"
    atividade = await sessao.get(Atividade, uuid.UUID(atividade_id))
    await sessao.refresh(atividade)
    assert atividade.cancelada_por == admin_usuario.id


async def test_admin_nao_cancela_atividade_que_ja_terminou(cliente, sessao):
    """Cancelar depois do evento negaria o certificado de quem foi."""
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    await _mover(sessao, atividade_id, dias=-1)

    resposta = await cliente.post(f"/api/v1/admin/atividades/{atividade_id}/cancelar",
                                  json={"motivo": "Tentativa tardia"},
                                  headers=_como(admin))
    assert resposta.status_code == 400


async def test_filtro_de_atividades_paradas(cliente, sessao):
    _, admin = await _admin(sessao)
    _, ong, _ = await _cadastrar(cliente, "ong")
    parada = await _atividade(cliente, ong)
    recente = await _atividade(cliente, ong)
    await _mover(sessao, parada, dias=-10)
    await _mover(sessao, recente, dias=-2)

    corpo = (await cliente.get("/api/v1/admin/atividades", params={"paradas": "true"},
                               headers=_como(admin))).json()
    assert [i["id"] for i in corpo["itens"]] == [parada]
    assert corpo["itens"][0]["podeForcarValidacao"] is True


# ===================== Forçar validação (FS-08) =====================


async def _cenario_parado(cliente, sessao, *, com_checkin=True, dias=-10):
    _, ong, _ = await _cadastrar(cliente, "ong")
    atividade_id = await _atividade(cliente, ong)
    alunos = []
    for _ in range(2):
        aluno_id, token = await _aluno_pronto(cliente)
        alunos.append((aluno_id, await _inscrever(cliente, token, atividade_id)))
    if com_checkin:
        await sessao.execute(update(Inscricao)
                             .where(Inscricao.id == uuid.UUID(alunos[0][1]))
                             .values(checkin_em=datetime.now(timezone.utc),
                                     checkin_origem="qr"))
        await sessao.commit()
    await _mover(sessao, atividade_id, dias=dias)
    return ong, atividade_id, alunos


async def test_forcar_validacao_com_checkin_emite_certificado(cliente, sessao):
    admin_usuario, admin = await _admin(sessao)
    _, atividade_id, alunos = await _cenario_parado(cliente, sessao)

    resposta = await cliente.post(
        f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
        json={"motivo": "ONG não responde há duas semanas",
              "politica": "checkin_presente"},
        headers=_como(admin))
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["situacao"] == "finalizada"
    assert corpo["presentes"] == 1
    assert corpo["certificadosEmitidos"] == 1

    cert = await sessao.scalar(select(Certificado))
    assert str(cert.usuario_id) == alunos[0][0]
    forcada = (await _acoes(sessao, "atividade.validacao_forcada"))[0]
    assert forcada.depois["politica"] == "checkin_presente"
    assert forcada.ator_id == admin_usuario.id


async def test_forcar_respeita_decisao_ja_tomada_pela_ong(cliente, sessao):
    """A política só vale para quem está sem decisão."""
    _, admin = await _admin(sessao)
    _, atividade_id, alunos = await _cenario_parado(cliente, sessao)
    # A ONG chegou a marcar como presente quem não tinha check-in.
    await sessao.execute(update(Inscricao)
                         .where(Inscricao.id == uuid.UUID(alunos[1][1]))
                         .values(situacao="presente"))
    await sessao.commit()

    corpo = (await cliente.post(
        f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
        json={"motivo": "ONG sumiu no meio da validação",
              "politica": "todos_ausentes"},
        headers=_como(admin))).json()
    assert corpo["presentes"] == 1


async def test_forcar_antes_do_prazo_da_ong(cliente, sessao):
    _, admin = await _admin(sessao)
    _, atividade_id, _ = await _cenario_parado(cliente, sessao, dias=-3)

    resposta = await cliente.post(
        f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
        json={"motivo": "Pressa indevida", "politica": "todos_ausentes"},
        headers=_como(admin))
    assert resposta.status_code == 400
    assert resposta.json()["codigo"] == "prazo_da_ong"


async def test_sem_checkin_so_da_para_marcar_ausentes(cliente, sessao):
    """FS-08 E2."""
    _, admin = await _admin(sessao)
    _, atividade_id, _ = await _cenario_parado(cliente, sessao, com_checkin=False)

    recusado = await cliente.post(
        f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
        json={"motivo": "ONG inerte", "politica": "checkin_presente"},
        headers=_como(admin))
    assert recusado.json()["codigo"] == "sem_checkin"

    aceito = await cliente.post(
        f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
        json={"motivo": "ONG inerte", "politica": "todos_ausentes"},
        headers=_como(admin))
    assert aceito.json()["certificadosEmitidos"] == 0


async def test_forcar_exige_politica_valida(cliente, sessao):
    _, admin = await _admin(sessao)
    _, atividade_id, _ = await _cenario_parado(cliente, sessao)
    resposta = await cliente.post(
        f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
        json={"motivo": "Motivo qualquer", "politica": "todos_presentes"},
        headers=_como(admin))
    assert resposta.status_code == 400


# ===================== Certificados (A7) e sistema (A8) =====================


async def _certificado_emitido(cliente, sessao) -> Certificado:
    _, admin = await _admin(sessao)
    _, atividade_id, _ = await _cenario_parado(cliente, sessao)
    await cliente.post(f"/api/v1/admin/atividades/{atividade_id}/forcar-validacao",
                       json={"motivo": "Para gerar certificado",
                             "politica": "checkin_presente"},
                       headers=_como(admin))
    return await sessao.scalar(select(Certificado))


async def test_lista_certificados_filtra_adulterados(cliente, sessao):
    cert = await _certificado_emitido(cliente, sessao)
    _, admin = await _admin(sessao)

    limpo = (await cliente.get("/api/v1/admin/certificados",
                               params={"situacaoAssinatura": "nao_confere"},
                               headers=_como(admin))).json()
    assert limpo["total"] == 0

    await sessao.execute(update(Certificado).where(Certificado.id == cert.id)
                         .values(horas=99))
    await sessao.commit()
    sessao.expire_all()

    sujo = (await cliente.get("/api/v1/admin/certificados",
                              params={"situacaoAssinatura": "nao_confere"},
                              headers=_como(admin))).json()
    assert sujo["total"] == 1
    assert sujo["itens"][0]["assinaturaConfere"] is False

    reconferido = (await cliente.post(
        f"/api/v1/admin/certificados/{cert.id}/reconferir",
        headers=_como(admin))).json()
    assert reconferido["assinaturaConfere"] is False


async def test_verificar_integridade_acha_a_adulteracao(cliente, sessao):
    """FS-11 — a contraprova do sistema."""
    cert = await _certificado_emitido(cliente, sessao)
    _, admin = await _admin(sessao)

    limpo = (await cliente.post("/api/v1/admin/sistema/verificar-integridade",
                                headers=_como(admin))).json()
    assert limpo["total"] == 1
    assert limpo["divergentes"] == []

    await sessao.execute(update(Certificado).where(Certificado.id == cert.id)
                         .values(nome_organizacao="ONG Fantasma"))
    await sessao.commit()
    sessao.expire_all()

    sujo = (await cliente.post("/api/v1/admin/sistema/verificar-integridade",
                               headers=_como(admin))).json()
    assert [d["codigo"] for d in sujo["divergentes"]] == [cert.codigo_verificacao]
    registros = await _acoes(sessao, "integridade.verificada")
    assert {r.depois["desfecho"] for r in registros} == {"integro", "adulterado"}


async def test_sistema_mostra_impressao_digital_e_chave_publica(cliente, sessao):
    _, admin = await _admin(sessao)
    info = (await cliente.get("/api/v1/admin/sistema", headers=_como(admin))).json()
    assert info["chave"]["impressaoDigital"] == security.impressao_digital_chave()
    assert "chave_assinatura" not in str(info).lower()

    pem = await cliente.get("/api/v1/admin/sistema/chave-publica",
                            headers=_como(admin))
    assert pem.content.startswith(b"-----BEGIN PUBLIC KEY-----")
    assert b"PRIVATE" not in pem.content


async def test_limpar_tokens_remove_so_os_vencidos(cliente, sessao):
    _, admin = await _admin(sessao)
    usuario_id, _, _ = await _cadastrar(cliente, "estudante")
    vencido = TokenSessao(usuario_id=uuid.UUID(usuario_id), token_hash="a" * 64,
                          familia_id=uuid.uuid4(),
                          expira_em=datetime.now(timezone.utc) - timedelta(days=1))
    sessao.add(vencido)
    await sessao.commit()

    resposta = (await cliente.post("/api/v1/admin/sistema/limpar-tokens",
                                   headers=_como(admin))).json()
    assert resposta["sessoes"] == 1
    # A sessão aberta no cadastro continua lá.
    restantes = (await sessao.scalars(select(TokenSessao).where(
        TokenSessao.usuario_id == uuid.UUID(usuario_id)))).all()
    assert len(restantes) == 1
