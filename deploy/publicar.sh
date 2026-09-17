#!/usr/bin/env bash
# Único comando que a chave do GitHub Actions pode rodar na VM.
#
# Fica preso em ~/.ssh/authorized_keys com command="...publicar.sh",restrict:
# qualquer coisa que o pipeline mande vira só o argumento abaixo, em
# $SSH_ORIGINAL_COMMAND. Sem shell, sem túnel, sem outra ação possível.
#
# Recebe o SHA que passou no CI e só publica se ele pertencer ao main.
set -euo pipefail
cd "$(dirname "$0")/.."

SHA="${SSH_ORIGINAL_COMMAND:-}"
if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Uso: informe o SHA completo de um commit do main." >&2
  exit 2
fi

exec 9>"$HOME/.mais-horas-publicacao.trava"
flock 9   # publicações em fila, nunca ao mesmo tempo

git fetch -q origin main
if ! git merge-base --is-ancestor "$SHA" origin/main; then
  echo "O commit ${SHA:0:7} não está no main." >&2
  exit 3
fi
if git merge-base --is-ancestor "$SHA" HEAD; then
  echo "${SHA:0:7} já está publicado (ou foi superado)."
  exit 0
fi

git merge -q --ff-only "$SHA"
cd deploy
sudo docker compose up -d --build
sudo docker image prune -f >/dev/null
echo "Publicado: ${SHA:0:7}"
