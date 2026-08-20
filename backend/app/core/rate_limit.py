"""
Rate limiting das rotas sensíveis (login e registro).

Substitui o express-rate-limit do backend Node, mantendo a mesma janela:
20 tentativas por IP a cada 15 minutos.

Implementado como dependência do FastAPI em vez de decorator porque decorator
que embrulha a função quebra a resolução de anotações do FastAPI quando o módulo
usa `from __future__ import annotations`.

O contador é em memória, por processo — igual ao express-rate-limit que estava
aqui antes. Se um dia a API rodar com mais de um worker, isso precisa migrar
para um contador compartilhado (Redis), senão o limite vira "20 por worker".
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request, status

from app.core.errors import AppError

WINDOW_SECONDS = 15 * 60
MAX_ATTEMPTS = 20

# ip -> lista de timestamps das tentativas dentro da janela
_attempts: dict[str, list[float]] = defaultdict(list)

# Evita o dicionário crescer sem limite com IPs que nunca voltam.
_last_cleanup = 0.0
CLEANUP_INTERVAL = 300


def _client_ip(request: Request) -> str:
    """
    IP do cliente. Considera X-Forwarded-For porque no Render a API fica atrás
    de proxy — sem isso, todo mundo compartilharia o IP do balanceador.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


def _cleanup(now: float) -> None:
    global _last_cleanup
    if now - _last_cleanup < CLEANUP_INTERVAL:
        return
    _last_cleanup = now
    cutoff = now - WINDOW_SECONDS
    vazios = [ip for ip, marks in _attempts.items() if not any(m > cutoff for m in marks)]
    for ip in vazios:
        del _attempts[ip]


async def auth_rate_limit(request: Request) -> None:
    """Dependência: barra o excesso de tentativas em login/registro."""
    now = time.monotonic()
    _cleanup(now)

    ip = _client_ip(request)
    cutoff = now - WINDOW_SECONDS

    recentes = [m for m in _attempts[ip] if m > cutoff]
    recentes.append(now)
    _attempts[ip] = recentes

    if len(recentes) > MAX_ATTEMPTS:
        raise AppError(
            "Muitas tentativas. Tente novamente em alguns minutos.",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )


def reset() -> None:
    """Zera o contador. Existe para os testes não vazarem estado entre si."""
    _attempts.clear()
