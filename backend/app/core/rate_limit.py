"""
Limite de tentativas nas rotas sensíveis (RNF-08).

Contador em memória, por processo — mesma limitação que o backend anterior
tinha. Com mais de um worker o limite passa a valer por worker; corrigir exige
contador compartilhado, registrado como dívida em docs/backend-refactor.md.

Implementado como dependência, não decorator: decorator que embrulha a função
quebra a resolução de anotações do FastAPI em módulo que usa
`from __future__ import annotations`.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request, status

from app.core.config import config
from app.core.errors import ErroDeNegocio

# Uma chave por (balde, ip): o limite da verificação pública não pode consumir
# o do login, nem o contrário.
_tentativas: dict[str, list[float]] = defaultdict(list)
_ultima_limpeza = 0.0
_INTERVALO_LIMPEZA = 300


def _ip(request: Request) -> str:
    """
    Considera X-Forwarded-For porque em produção a API fica atrás de proxy —
    sem isso, todos compartilhariam o IP do balanceador.
    """
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


def _limpar(agora: float, janela: float) -> None:
    global _ultima_limpeza
    if agora - _ultima_limpeza < _INTERVALO_LIMPEZA:
        return
    _ultima_limpeza = agora
    corte = agora - janela
    vazios = [ip for ip, marcas in _tentativas.items()
              if not any(m > corte for m in marcas)]
    for ip in vazios:
        del _tentativas[ip]


def _contar(balde: str, request: Request, maximo: int, janela: float,
            mensagem: str) -> None:
    agora = time.monotonic()
    _limpar(agora, janela)

    chave = f"{balde}:{_ip(request)}"
    corte = agora - janela
    recentes = [m for m in _tentativas[chave] if m > corte]
    recentes.append(agora)
    _tentativas[chave] = recentes

    if len(recentes) > maximo:
        raise ErroDeNegocio("muitas_tentativas", mensagem,
                            status.HTTP_429_TOO_MANY_REQUESTS)


async def limite_de_autenticacao(request: Request) -> None:
    """Barra o excesso de tentativas em cadastro e login."""
    _contar("auth", request, config.rate_limit_tentativas,
            config.rate_limit_janela_minutos * 60,
            "Muitas tentativas. Tente novamente em alguns minutos.")


async def limite_de_verificacao(request: Request) -> None:
    """
    RN-52 — a verificação é pública e sem login, então é o alvo natural de quem
    quisesse varrer códigos. 60 por minuto sobra para uma coordenação conferindo
    uma pilha de certificados e torna a varredura de 2^64 códigos inútil.
    """
    _contar("verificacao", request, config.verificacao_por_minuto, 60,
            "Muitas verificações seguidas. Aguarde um minuto e tente de novo.")


def zerar() -> None:
    """Limpa o contador. Existe para os testes não vazarem estado entre si."""
    _tentativas.clear()
