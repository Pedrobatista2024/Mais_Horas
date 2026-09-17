"""Configuração da aplicação, lida do ambiente (.env)."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

FUSO = "America/Sao_Paulo"  # RN-53


class Configuracao(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ===== Servidor =====
    port: int = 3000
    ambiente: str = Field(default="desenvolvimento")

    # ===== Banco =====
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/mais_horas"
    )
    database_url_teste: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/mais_horas_teste"
    )
    # SSL na conexão com o banco. Sem valor, segue o ambiente (produção liga).
    # Banco na mesma máquina, em rede interna do Docker, dispensa: PGSSL=false.
    pgssl: bool | None = None

    # ===== Sessão =====
    jwt_secret: str = Field(default="")
    jwt_algoritmo: str = "HS256"
    access_token_minutos: int = 15
    refresh_token_dias: int = 7
    # Janela em que reapresentar um refresh já usado conta como corrida benigna,
    # e não como roubo — ver docs/autenticacao.md.
    refresh_graca_segundos: int = 15

    # ===== Assinatura do certificado (D4) =====
    # Chave privada Ed25519 em PEM, base64. NUNCA vai para o banco nem para o git.
    # Gere com: python -m app.cli gerar-chave
    chave_assinatura: str = Field(default="")

    # ===== Check-in por QR (D31) =====
    # Segredo próprio: comprometer o QR não deve comprometer a sessão.
    checkin_secret: str = Field(default="")
    checkin_janela_segundos: int = 30
    # Folga depois que a janela fecha, para a requisição de quem escaneou no
    # último instante chegar. Soma com a janela o tempo máximo de vida do QR.
    checkin_graca_segundos: int = 10

    # ===== Modo "entrar como" (D13, RN-31) =====
    espelho_minutos: int = 30

    # ===== Portal (T2) =====
    # Código de um certificado de demonstração, emitido para uma conta de teste.
    # Vazio: o botão "Ver uma verificação de exemplo" não aparece.
    certificado_demonstracao: str = ""

    # ===== URLs públicas =====
    app_url: str = "http://localhost:3000"
    web_url: str = "http://localhost:5173"
    cors_origin: str = ""

    # ===== Uploads =====
    upload_dir: str = "uploads"
    upload_max_bytes: int = 2 * 1024 * 1024

    # ===== E-mail (D39) =====
    # "console" escreve no terminal; qualquer outro valor exige provedor configurado.
    email_modo: str = "console"

    # ===== Limites =====
    rate_limit_tentativas: int = 20
    rate_limit_janela_minutos: int = 15
    inscricoes_ativas_max: int = 5           # RN-46
    verificacao_por_minuto: int = 60         # RN-52

    @field_validator("database_url", "database_url_teste")
    @classmethod
    def _normalizar_url(cls, v: str) -> str:
        """Aceita a URL no formato do Render e converte para o driver assíncrono."""
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def producao(self) -> bool:
        return self.ambiente.lower() in ("producao", "production")

    @property
    def cors_origens(self) -> list[str]:
        """Origens permitidas. Vazio libera todas — só aceitável fora de produção."""
        if not self.cors_origin.strip():
            return []
        return [o.strip() for o in self.cors_origin.split(",") if o.strip()]

    @property
    def cookie_secure(self) -> bool:
        return self.producao

    @property
    def cookie_samesite(self) -> str:
        """
        Em produção o site e a API ficam em domínios diferentes, então o cookie
        de refresh precisa de SameSite=None. Em desenvolvimento, 'lax' basta e
        evita exigir HTTPS.
        """
        return "none" if self.producao else "lax"


@lru_cache
def obter_configuracao() -> Configuracao:
    return Configuracao()


config = obter_configuracao()
