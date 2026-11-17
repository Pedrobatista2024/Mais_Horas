"""
Controle do simulador: o botão do modo apresentação.

Sobe o simulador (simulador.py) em segundo plano e oferece, em
/monitoramento/demonstracao/, uma página para ligar e desligar o modo
apresentação. O Caddy só deixa chegar aqui quem tem sessão aberta no Grafana
(deploy/Caddyfile), e os POST ainda conferem que vieram do próprio site: um
link de outro lugar não consegue disparar tráfego.

/metrics (fora do prefixo, só na rede interna) diz ao Prometheus se o modo
está ligado e quanto falta, para o painel "Ao vivo" mostrar.
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from prometheus_client import CONTENT_TYPE_LATEST, Gauge, generate_latest

import simulador

PREFIXO = "/monitoramento/demonstracao"
PAINEL_AO_VIVO = "/monitoramento/d/ao-vivo/ao-vivo?orgId=1&refresh=5s&kiosk"
DOMINIO = os.environ.get("DOMINIO", "localhost")

ATIVA = Gauge("simulador_apresentacao_ativa", "1 enquanto o modo apresentação está ligado.")
RESTANTE = Gauge("simulador_apresentacao_restante_segundos",
                 "Segundos até o modo apresentação desligar sozinho.")


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    http = simulador.novo_cliente()
    sim = simulador.criar(http)
    app.state.simulador = sim
    ATIVA.set_function(lambda: 1 if sim.restante() > 0 else 0)
    RESTANTE.set_function(sim.restante)
    tarefa = asyncio.create_task(simulador.rodar(sim))
    yield
    tarefa.cancel()
    await http.aclose()


app = FastAPI(title="Simulador do Mais Horas", docs_url=None, redoc_url=None,
              openapi_url=None, lifespan=ciclo_de_vida)


def _do_proprio_site(request: Request) -> bool:
    origem = request.headers.get("origin") or request.headers.get("referer") or ""
    return urlparse(origem).hostname == DOMINIO


PAGINA = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demonstração ao vivo – Mais Horas</title>
<style>
  :root { --noite: #0b1a4d; --royal: #1839b0; --claro: #edf1fc; --tinta: #1b2540;
          --apagado: #5c6882; --linha: #d3dcf3; --verde: #2b8a3e; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: var(--claro); color: var(--tinta);
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         display: grid; place-items: center; padding: 24px 16px; }
  main { width: 100%; max-width: 560px; background: #fff; border: 1px solid var(--linha);
         border-radius: 20px; padding: 32px; }
  h1 { margin: 0 0 6px; color: var(--noite); font-size: 26px; line-height: 1.2; }
  p { margin: 0 0 20px; color: var(--apagado); }
  .estado { display: flex; align-items: center; gap: 14px; padding: 18px 20px;
            border-radius: 14px; background: var(--claro); margin-bottom: 20px; }
  .ponto { width: 14px; height: 14px; border-radius: 50%; background: #9aa5bd; flex: none; }
  .ligado .ponto { background: var(--verde); box-shadow: 0 0 0 6px rgba(43, 138, 62, .18); }
  .estado strong { display: block; font-size: 18px; }
  .estado span { color: var(--apagado); font-size: 14px; }
  .botoes { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  button { width: 100%; border: 0; border-radius: 999px; padding: 14px; font: inherit;
           font-weight: 600; color: #fff; background: var(--royal); cursor: pointer; }
  button.secundario { background: #fff; color: var(--tinta); border: 1px solid var(--linha); }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button:focus-visible, a:focus-visible { outline: 2px solid var(--royal); outline-offset: 2px; }
  a { color: var(--royal); font-weight: 600; }
  small { display: block; margin-top: 20px; color: var(--apagado); line-height: 1.5; }
  code { font-size: 13px; background: var(--claro); padding: 2px 6px; border-radius: 6px; }
</style>
</head>
<body>
<main>
  <h1>Demonstração ao vivo</h1>
  <p>Liga um movimento forte no Mais Horas por alguns minutos: gente se cadastrando,
     entrando, se inscrevendo, conferindo certificados, e um ataque simulado a cada
     minuto. Os gráficos do painel <a href="PAINEL">Ao vivo</a> atualizam a cada 5 segundos.</p>
  <div class="estado" id="estado"><div class="ponto"></div>
    <div><strong id="titulo">Carregando…</strong><span id="detalhe"></span></div></div>
  <div class="botoes">
    <form method="post" action="iniciar?minutos=5"><button id="b5">Iniciar 5 min</button></form>
    <form method="post" action="iniciar?minutos=15"><button id="b15">Iniciar 15 min</button></form>
  </div>
  <form method="post" action="parar"><button class="secundario" id="parar">Parar agora</button></form>
  <small>Tudo passa pela API de verdade, com contas em <code>@demonstracao.mais-horas.org</code>
     e IPs reservados para documentação. Para apagar o que foi criado, no servidor:
     <code>python -m app.cli remover-demonstracao --confirmar</code>
     (docs/monitoramento.md). <a href="/monitoramento/">Voltar aos painéis</a></small>
</main>
<script>
  function minutos(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60);
                        return m + ":" + String(r).padStart(2, "0"); }
  async function atualizar() {
    try {
      const e = await (await fetch("estado", { cache: "no-store" })).json();
      const caixa = document.getElementById("estado");
      caixa.classList.toggle("ligado", e.ativa);
      document.getElementById("titulo").textContent =
        !e.pronto ? "Preparando as contas…" : e.ativa ? "Ligada" : "Desligada";
      document.getElementById("detalhe").textContent =
        e.ativa ? minutos(e.restante) + " para desligar sozinha" : "Movimento normal do dia";
      document.getElementById("parar").disabled = !e.ativa;
      for (const id of ["b5", "b15"]) {
        const b = document.getElementById(id);
        b.disabled = !e.pronto;
        b.textContent = (e.ativa ? "Mais " : "Iniciar ") + (id === "b5" ? "5" : "15") + " min";
      }
    } catch (erro) {
      document.getElementById("titulo").textContent = "Simulador sem resposta";
    }
  }
  atualizar();
  setInterval(atualizar, 2000);
</script>
</body>
</html>
"""


@app.get(f"{PREFIXO}/", response_class=HTMLResponse)
async def pagina() -> str:
    return PAGINA.replace("PAINEL", PAINEL_AO_VIVO)


@app.get(f"{PREFIXO}/estado")
async def estado(request: Request) -> dict:
    sim = request.app.state.simulador
    return {"ativa": sim.restante() > 0, "restante": round(sim.restante()),
            "pronto": sim.pronto}


@app.post(f"{PREFIXO}/iniciar")
async def iniciar(request: Request, minutos: int = Query(5, ge=1, le=simulador.MINUTOS_MAXIMOS)):
    if not _do_proprio_site(request):
        raise HTTPException(403, "Use o botão da página de demonstração.")
    sim = request.app.state.simulador
    if not sim.pronto:
        raise HTTPException(409, "O simulador ainda está criando as contas. Tente em um minuto.")
    sim.iniciar_apresentacao(minutos)
    return RedirectResponse(PAINEL_AO_VIVO, status_code=303)


@app.post(f"{PREFIXO}/parar")
async def parar(request: Request):
    if not _do_proprio_site(request):
        raise HTTPException(403, "Use o botão da página de demonstração.")
    request.app.state.simulador.parar_apresentacao()
    return RedirectResponse(f"{PREFIXO}/", status_code=303)


@app.get("/metrics", include_in_schema=False)
async def metricas() -> Response:
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
