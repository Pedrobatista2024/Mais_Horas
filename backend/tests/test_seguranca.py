"""Testes do núcleo de segurança: senha, sessão, assinatura e token de QR."""

from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timezone

import pytest

from app.core import security as seg
from app.core.config import config


# ===================== Senhas (RNF-03) =====================


def test_senha_correta_e_aceita():
    assert seg.conferir_senha("senha-bem-longa", seg.gerar_hash_senha("senha-bem-longa"))


def test_senha_errada_e_recusada():
    assert not seg.conferir_senha("outra", seg.gerar_hash_senha("senha-bem-longa"))


def test_hash_novo_usa_argon2id():
    assert seg.gerar_hash_senha("qualquer").startswith("$argon2id$")


def test_dois_hashes_da_mesma_senha_sao_diferentes():
    """Sal aleatório: hashes iguais denunciariam senhas iguais entre usuários."""
    a = seg.gerar_hash_senha("mesma-senha")
    b = seg.gerar_hash_senha("mesma-senha")
    assert a != b


def test_hash_bcrypt_legado_continua_sendo_aceito():
    """Conta herdada do backend Node entra sem precisar trocar a senha."""
    legado = "$2a$10$BpkMXZfQNcBgBNhYpe7H7.7FPKudkFFyOUNFb9IYp3EWeGbZuhBEG"
    assert seg.conferir_senha("senha123", legado)
    assert not seg.conferir_senha("errada", legado)


def test_hash_legado_e_marcado_para_regravar():
    legado = "$2a$10$BpkMXZfQNcBgBNhYpe7H7.7FPKudkFFyOUNFb9IYp3EWeGbZuhBEG"
    assert seg.precisa_regravar(legado)
    assert not seg.precisa_regravar(seg.gerar_hash_senha("nova"))


def test_hash_vazio_nao_derruba_nem_autentica():
    assert not seg.conferir_senha("qualquer", "")


# ===================== Access token =====================


def test_access_token_ida_e_volta():
    uid = uuid.uuid4()
    token, expira = seg.criar_access_token(uid, "estudante")
    payload = seg.ler_access_token(token)

    assert payload is not None
    assert payload["sub"] == str(uid)
    assert payload["papel"] == "estudante"
    assert expira == config.access_token_minutos * 60


def test_token_adulterado_e_recusado():
    token, _ = seg.criar_access_token(uuid.uuid4(), "ong")
    assert seg.ler_access_token(token[:-4] + "aaaa") is None


def test_token_de_outro_segredo_e_recusado():
    import jwt
    forjado = jwt.encode(
        {"sub": str(uuid.uuid4()), "papel": "superadmin", "tipo": "acesso"},
        "segredo-do-atacante", algorithm="HS256",
    )
    assert seg.ler_access_token(forjado) is None


def test_cada_token_tem_identificador_proprio():
    a, _ = seg.criar_access_token(uuid.uuid4(), "estudante")
    b, _ = seg.criar_access_token(uuid.uuid4(), "estudante")
    assert seg.ler_access_token(a)["jti"] != seg.ler_access_token(b)["jti"]


# ===================== Refresh token (RNF-05) =====================


def test_refresh_e_guardado_apenas_como_resumo():
    bruto = seg.gerar_refresh_token()
    resumo = seg.hash_refresh_token(bruto)

    assert resumo != bruto
    assert len(resumo) == 64
    assert seg.hash_refresh_token(bruto) == resumo  # determinístico, permite busca


def test_dois_refresh_nunca_colidem():
    assert len({seg.gerar_refresh_token() for _ in range(200)}) == 200


# ===================== Assinatura do certificado (D4) =====================


@pytest.fixture(autouse=True)
def _chave(monkeypatch):
    """Gera um par só para os testes, sem depender do .env."""
    privada, _ = seg.gerar_par_de_chaves()
    monkeypatch.setattr(config, "chave_assinatura", privada)


def _texto(**troca):
    campos = dict(
        codigo="a1b2c3d4e5f60718", nome_aluno="Maria Silva",
        organizacao="ONG Verde Vida", titulo_atividade="Mutirão de limpeza",
        horas=4, data_atividade=date(2026, 6, 15),
        emitido_em=datetime(2026, 6, 15, 19, 0, tzinfo=timezone.utc),
    )
    campos.update(troca)
    return seg.texto_canonico_certificado(**campos)


def test_assinatura_propria_confere():
    texto = _texto()
    assert seg.conferir_assinatura(texto, seg.assinar_certificado(texto))


def test_dado_alterado_invalida_a_assinatura():
    """O caso que a assinatura existe para pegar: escrita direta no banco."""
    assinatura = seg.assinar_certificado(_texto())
    assert not seg.conferir_assinatura(_texto(horas=40), assinatura)


@pytest.mark.parametrize("campo,valor", [
    ("organizacao", "ONG Fantasma"),
    ("data_atividade", date(2026, 6, 16)),
    ("nome_aluno", "Outra Pessoa"),
    ("titulo_atividade", "Outra atividade"),
    ("codigo", "ffffffffffffffff"),
])
def test_todo_campo_exibido_esta_coberto(campo, valor):
    """Cada campo que a verificação pública mostra precisa quebrar a assinatura."""
    assinatura = seg.assinar_certificado(_texto())
    assert not seg.conferir_assinatura(_texto(**{campo: valor}), assinatura)


def test_separador_no_nome_nao_desloca_campos():
    """Com texto separado por `|`, "A|B"+"C" e "A"+"B|C" dariam o mesmo texto."""
    um = _texto(nome_aluno="Maria|ONG X", organizacao="Y")
    outro = _texto(nome_aluno="Maria", organizacao="ONG X|Y")
    assert um != outro


def test_assinatura_de_outra_chave_nao_confere(monkeypatch):
    texto = _texto()
    outra, _ = seg.gerar_par_de_chaves()
    monkeypatch.setattr(config, "chave_assinatura", outra)
    assinatura_intrusa = seg.assinar_certificado(texto)

    original, _ = seg.gerar_par_de_chaves()
    monkeypatch.setattr(config, "chave_assinatura", original)
    assert not seg.conferir_assinatura(texto, assinatura_intrusa)


def test_assinatura_corrompida_nao_derruba():
    assert not seg.conferir_assinatura(_texto(), "isto-nao-e-base64-valido!!")


def test_texto_canonico_e_estavel():
    """A ordem faz parte do contrato: mudá-la invalida todo certificado emitido."""
    assert _texto() == (
        '["MHC1","a1b2c3d4e5f60718","Maria Silva","ONG Verde Vida",'
        '"Mutirão de limpeza",4,"2026-06-15","2026-06-15T19:00:00+00:00"]'
    )


def test_chave_ausente_falha_com_mensagem_util(monkeypatch):
    monkeypatch.setattr(config, "chave_assinatura", "")
    with pytest.raises(RuntimeError, match="gerar-chave"):
        seg.assinar_certificado("qualquer")


# ===================== Token de check-in (D31, RN-16) =====================


@pytest.fixture(autouse=True)
def _segredo_checkin(monkeypatch):
    monkeypatch.setattr(config, "checkin_secret", "segredo-de-teste-do-checkin")


def test_token_da_janela_atual_e_aceito():
    atividade = uuid.uuid4()
    assert seg.conferir_token_checkin(seg.gerar_token_checkin(atividade), atividade)


def test_token_de_outra_atividade_e_recusado():
    """Impede usar o QR de um evento para marcar presença em outro."""
    token = seg.gerar_token_checkin(uuid.uuid4())
    assert not seg.conferir_token_checkin(token, uuid.uuid4())


def test_token_antigo_e_recusado():
    """
    O coração da proteção: a fotografia do QR repassada a quem não foi chega
    expirada.
    """
    atividade = uuid.uuid4()
    janela = int(time.time() // config.checkin_janela_segundos)
    antigo = seg.gerar_token_checkin(atividade, janela - 5)
    assert not seg.conferir_token_checkin(antigo, atividade)


def test_janela_anterior_e_tolerada_dentro_da_graca():
    """
    Cobre o intervalo entre ver o código na tela e a requisição chegar. Sem
    isso, quem escaneasse no último segundo seria recusado sem culpa.

    O relógio é fixado no teste porque a tolerância é medida a partir do fim da
    janela: deixá-la depender da hora de execução faria o teste passar ou falhar
    conforme o minuto.
    """
    atividade = uuid.uuid4()
    duracao = config.checkin_janela_segundos
    janela = 1_000_000

    # 5 s depois que a janela fechou — dentro da graça de 10 s.
    momento = (janela + 1) * duracao + 5
    assert seg.ler_token_checkin(
        seg.gerar_token_checkin(atividade, janela), momento).valido


def test_token_morre_ao_fim_da_graca():
    """Nenhum código sobrevive além de `janela + graça` — 40 s no padrão."""
    atividade = uuid.uuid4()
    duracao = config.checkin_janela_segundos
    janela = 1_000_000

    limite = (janela + 1) * duracao + config.checkin_graca_segundos
    lido = seg.ler_token_checkin(seg.gerar_token_checkin(atividade, janela), limite)
    assert not lido.valido
    assert lido.motivo == "expirado"


def test_codigo_de_quarenta_segundos_atras_e_sempre_recusado():
    """
    É o critério da fatia, e precisa valer em qualquer instante do relógio —
    não só quando a fase da janela ajuda.
    """
    atividade = uuid.uuid4()
    duracao = config.checkin_janela_segundos

    for deslocamento in range(0, duracao):
        agora = 3_000_000 * duracao + deslocamento
        janela_do_codigo = int((agora - 40) // duracao)
        antigo = seg.gerar_token_checkin(atividade, janela_do_codigo)
        assert not seg.ler_token_checkin(antigo, agora).valido, (
            f"aceito com deslocamento {deslocamento}s dentro da janela"
        )


def test_token_diz_de_qual_atividade_e():
    """
    Sem isso o servidor não conseguiria responder "este código é de outra
    atividade" — o `POST /checkin` recebe só o token.
    """
    atividade = uuid.uuid4()
    lido = seg.ler_token_checkin(seg.gerar_token_checkin(atividade))
    assert lido.atividade_id == atividade


def test_token_adulterado_acusa_assinatura_e_nao_validade():
    """Forjar não merece a mensagem simpática de "código vencido"."""
    atividade = uuid.uuid4()
    token = seg.gerar_token_checkin(atividade)
    corpo, assinatura = token.rsplit(".", 1)
    adulterado = f"{corpo}.{'A' * len(assinatura)}"

    lido = seg.ler_token_checkin(adulterado)
    assert not lido.valido
    assert lido.motivo == "assinatura_invalida"


def test_token_malformado_nao_explode():
    for lixo in ("", "abc", "MH1.só-uma-parte", "XX9.a.1.b", "MH1.###.1.###"):
        lido = seg.ler_token_checkin(lixo)
        assert not lido.valido
        assert lido.motivo in ("malformado", "assinatura_invalida")


def test_token_muda_de_uma_janela_para_a_outra():
    atividade = uuid.uuid4()
    janela = int(time.time() // config.checkin_janela_segundos)
    assert (seg.gerar_token_checkin(atividade, janela)
            != seg.gerar_token_checkin(atividade, janela + 1))


def test_token_e_inforjavel_sem_o_segredo(monkeypatch):
    atividade = uuid.uuid4()
    monkeypatch.setattr(config, "checkin_secret", "segredo-do-atacante")
    forjado = seg.gerar_token_checkin(atividade)
    monkeypatch.setattr(config, "checkin_secret", "segredo-de-teste-do-checkin")
    assert not seg.conferir_token_checkin(forjado, atividade)


def test_contagem_para_o_proximo_token_fica_na_janela():
    restante = seg.segundos_ate_proximo_token()
    assert 0 < restante <= config.checkin_janela_segundos


# ===================== Código de verificação =====================


def test_codigo_de_verificacao_tem_16_hex():
    codigo = seg.gerar_codigo_verificacao()
    assert len(codigo) == 16
    assert all(c in "0123456789abcdef" for c in codigo)


def test_codigos_nao_colidem():
    assert len({seg.gerar_codigo_verificacao() for _ in range(500)}) == 500
