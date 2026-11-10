"""
Serviço de relatórios em PDF do monitoramento.

O Grafana gratuito não exporta PDF; este serviço faz o relatório que a
apresentação e a coordenação pedem: indicadores com nível, comparação com o
período anterior e o detalhe de segurança. Fica atrás do Caddy, que só deixa
passar quem tem sessão aberta no Grafana (deploy/Caddyfile).
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, Response

from consultas import PERIODOS, coletar
from pdf import FUSO, montar

PREFIXO = "/monitoramento/relatorios"

app = FastAPI(title="Relatórios do Mais Horas", docs_url=None, redoc_url=None,
              openapi_url=None)

PAGINA = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório de saúde – Mais Horas</title>
<style>
  :root { --noite: #0b1a4d; --royal: #1839b0; --claro: #edf1fc; --tinta: #1b2540;
          --apagado: #5c6882; --linha: #d3dcf3; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: var(--claro); color: var(--tinta);
         font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         display: grid; place-items: center; padding: 24px 16px; }
  main { width: 100%; max-width: 520px; background: #fff; border: 1px solid var(--linha);
         border-radius: 20px; padding: 32px; }
  h1 { margin: 0 0 6px; color: var(--noite); font-size: 26px; line-height: 1.2; }
  p { margin: 0 0 20px; color: var(--apagado); }
  fieldset { border: 0; padding: 0; margin: 0 0 24px; display: grid; gap: 10px; }
  legend { font-weight: 600; margin-bottom: 10px; }
  label { display: flex; gap: 12px; align-items: center; padding: 12px 14px;
          border: 1px solid var(--linha); border-radius: 12px; cursor: pointer; }
  label:has(input:checked) { border-color: var(--royal); background: var(--claro); }
  input { accent-color: var(--royal); width: 18px; height: 18px; }
  button { width: 100%; border: 0; border-radius: 999px; padding: 14px; font: inherit;
           font-weight: 600; color: #fff; background: var(--royal); cursor: pointer; }
  button:focus-visible, label:focus-within { outline: 2px solid var(--royal);
                                             outline-offset: 2px; }
  a { color: var(--royal); }
  small { display: block; margin-top: 16px; color: var(--apagado); }
</style>
</head>
<body>
<main>
  <h1>Relatório de saúde</h1>
  <p>Disponibilidade, desempenho, segurança e uso do Mais Horas, com nível de cada
     indicador e comparação com o período anterior de mesma duração.</p>
  <form action="pdf" method="get">
    <fieldset>
      <legend>Período</legend>
      OPCOES
    </fieldset>
    <button type="submit">Gerar PDF</button>
  </form>
  <small>O PDF leva alguns segundos. <a href="/monitoramento/">Voltar aos painéis</a></small>
</main>
</body>
</html>
"""


@app.get(f"{PREFIXO}/", response_class=HTMLResponse)
async def pagina() -> str:
    opcoes = "\n      ".join(
        f'<label><input type="radio" name="periodo" value="{chave}"'
        f'{" checked" if chave == "7d" else ""}> {rotulo}</label>'
        for chave, (rotulo, _, _) in PERIODOS.items())
    return PAGINA.replace("OPCOES", opcoes)


@app.get(f"{PREFIXO}/pdf")
async def pdf(periodo: str = Query("7d")) -> Response:
    if periodo not in PERIODOS:
        raise HTTPException(400, "Período inválido. Use 24h, 7d ou 30d.")
    agora = datetime.now(timezone.utc).replace(microsecond=0)
    dados = await coletar(periodo, agora)
    arquivo = f"mais-horas-saude-{agora.astimezone(FUSO):%Y-%m-%d}-{periodo}.pdf"
    return Response(montar(dados, agora), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{arquivo}"'})


@app.get(f"{PREFIXO}/saude")
async def saude() -> dict[str, str]:
    return {"status": "ok"}
