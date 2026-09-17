#!/usr/bin/env bash
# Publica sozinho o que chega no main — chamado a cada 2 minutos pelo timer
# mais-horas-deploy (instalado pelo instalar.sh).
#
# A VM puxa do GitHub em vez de o GitHub entrar na VM: nenhuma chave de acesso
# ao servidor precisa ficar guardada fora dele. Só publica commit com o CI
# verde; commit reprovado fica anotado e não é tentado de novo.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="Pedrobatista2024/Mais_Horas"
ESTADO="$HOME/.mais-horas-deploy"
mkdir -p "$ESTADO"

exec 9>"$ESTADO/trava"
flock -n 9 || exit 0   # uma publicação por vez

git fetch -q origin main
ATUAL="$(git rev-parse HEAD)"
NOVO="$(git rev-parse origin/main)"
[ "$ATUAL" = "$NOVO" ] && exit 0
grep -qx "$NOVO" "$ESTADO/reprovados" 2>/dev/null && exit 0

log() { echo "$(date -Is) ${NOVO:0:7} $*"; }

# Resultado do CI pela API pública (sem token: 60 consultas/hora por IP, e
# só consultamos quando há commit novo).
RESPOSTA="$(curl -fsS -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/$REPO/commits/$NOVO/check-runs?per_page=100")" \
  || { log "não consegui consultar o CI; tento de novo depois"; exit 0; }

TOTAL="$(jq '.check_runs | length' <<<"$RESPOSTA")"
PENDENTES="$(jq '[.check_runs[] | select(.status != "completed")] | length' <<<"$RESPOSTA")"
FALHAS="$(jq '[.check_runs[] | select(.status == "completed"
          and (.conclusion != "success" and .conclusion != "skipped"))] | length' <<<"$RESPOSTA")"

if [ "$TOTAL" -eq 0 ] || [ "$PENDENTES" -gt 0 ]; then
  exit 0   # CI ainda rodando (ou nem começou)
fi
if [ "$FALHAS" -gt 0 ]; then
  echo "$NOVO" >> "$ESTADO/reprovados"
  log "CI reprovado — não publicado"
  exit 0
fi

log "CI verde — publicando"
if ./deploy/atualizar.sh; then
  log "publicado"
else
  log "FALHA ao publicar"
  exit 1
fi
