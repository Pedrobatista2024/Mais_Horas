#!/usr/bin/env bash
# Cópia do banco em ~/backups, guardando os últimos 14 dias.
# Restaurar: sudo docker compose exec -T banco pg_restore -U maishoras -d mais_horas --clean < arquivo.dump
set -euo pipefail
cd "$(dirname "$0")"
DESTINO="$HOME/backups"
mkdir -p "$DESTINO"
ARQUIVO="$DESTINO/mais_horas-$(date +%F).dump"
sudo docker compose exec -T banco pg_dump -U maishoras -Fc mais_horas > "$ARQUIVO"
chmod 600 "$ARQUIVO"
find "$DESTINO" -name 'mais_horas-*.dump' -mtime +14 -delete
echo "$(date -Is) backup ok: $ARQUIVO"
