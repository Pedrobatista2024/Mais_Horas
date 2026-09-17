#!/usr/bin/env bash
# Publica o que está no main: baixa, recompila e reinicia o que mudou.
set -euo pipefail
cd "$(dirname "$0")"
git pull --ff-only
sudo docker compose up -d --build
sudo docker image prune -f >/dev/null
echo "Atualizado."
