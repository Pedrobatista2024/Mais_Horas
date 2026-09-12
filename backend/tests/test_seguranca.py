"""Testes do núcleo de segurança: senha, sessão, assinatura e token de QR."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

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


def _texto(codigo="a1b2c3d4e5f60718"):
    return seg.texto_canonico_certificado(
        codigo, "Maria Silva", "Mutirão de limpeza", 4,
        datetime(2026, 6, 15, 19, 0, tzinfo=timezone.utc),
    )


def test_assinatura_propria_confere():
    texto = _texto()
    assert seg.conferir_assinatura(texto, seg.assinar_certificado(texto))


def test_dado_alterado_invalida_a_assinatura():
    """O caso que a assinatura existe para pegar: escrita direta no banco."""
    assinatura = seg.assinar_certificado(_texto())
    adulterado = seg.texto_canonico_certificado(
        "a1b2c3d4e5f60718", "Maria Silva", "Mutirão de limpeza",
        40,  # horas infladas
        datetime(2026, 6, 15, 19, 0, tzinfo=timezone.utc),
    )
    assert not seg.conferir_assinatura(adulterado, assinatura)


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
        "a1b2c3d4e5f60718|Maria Silva|Mutirão de limpeza|4|2026-06-15T19:00:00+00:00"
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


def test_janela_anterior_e_tolerada():
    """
    Cobre o intervalo entre ver o código na tela e a requisição chegar. Sem
    isso, quem escaneasse no último segundo seria recusado sem culpa.
    """
    atividade = uuid.uuid4()
    janela = int(time.time() // config.checkin_janela_segundos)
    assert seg.conferir_token_checkin(
        seg.gerar_token_checkin(atividade, janela - 1), atividade
    )


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
