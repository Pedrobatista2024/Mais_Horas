"""Configuração da aplicação, lida do ambiente (.env)."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ===== Servidor =====
    port: int = 3000
    environment: str = Field(default="development")

    # ===== Banco =====
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5433/mais_horas"
    )
    pgssl: bool = False

    # ===== Segurança =====
    jwt_secret: str = Field(default="")
    jwt_algorithm: str = "HS256"

    # Access token curto: se vazar, a janela de abuso é pequena.
    access_token_expire_minutes: int = 15
    # Refresh token longo: fica em cookie httpOnly e rotaciona a cada uso.
    refresh_token_expire_days: int = 7

    # ===== URLs públicas =====
    app_url: str = "http://localhost:3000"
    web_url: str = "http://localhost:5173"
    cors_origin: str = ""

    # ===== Uploads =====
    upload_dir: str = "uploads"
    max_upload_bytes: int = 2 * 1024 * 1024  # 2MB

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        """Aceita a URL no formato do Render/psycopg e converte para asyncpg."""
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins(self) -> list[str]:
        """Origens permitidas. Vazio libera todas — só aceitável em dev."""
        if not self.cors_origin.strip():
            return []
        return [o.strip() for o in self.cors_origin.split(",") if o.strip()]

    @property
    def cookie_secure(self) -> bool:
        """Cookie de refresh só viaja em HTTPS quando em produção."""
        return self.is_production

    @property
    def cookie_samesite(self) -> str:
        """
        Em produção o front (mais-horas-web) e a API (mais-horas-api) ficam em
        domínios diferentes, então o cookie precisa de SameSite=None.
        Em dev, 'lax' já resolve e evita exigir HTTPS.
        """
        return "none" if self.is_production else "lax"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
