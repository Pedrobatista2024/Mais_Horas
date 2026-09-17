#!/usr/bin/env bash
# Prepara um Ubuntu 24.04 recém-criado e sobe o Mais Horas.
# Uso (de dentro do repositório clonado):  ./deploy/instalar.sh <dominio>
# Pode rodar de novo: o que já existe (swap, .env, chave) é mantido.
set -euo pipefail

DOMINIO="${1:?uso: ./deploy/instalar.sh <dominio, sem https://>}"
cd "$(dirname "$0")"

echo "==> Pacotes"
sudo apt-get update -qq
sudo apt-get install -y -qq docker.io docker-compose-v2 openssl cron
sudo systemctl enable --now docker
DOCKER="sudo docker"

echo "==> Swap de 2 GB (folga para o build do site)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Segredos"
if [ ! -f .env ]; then
  umask 077
  sed \
    -e "s|^DOMINIO=.*|DOMINIO=${DOMINIO}|" \
    -e "s|^POSTGRES_SENHA=.*|POSTGRES_SENHA=$(openssl rand -hex 24)|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^CHECKIN_SECRET=.*|CHECKIN_SECRET=$(openssl rand -hex 32)|" \
    .env.exemplo > .env
else
  sed -i "s|^DOMINIO=.*|DOMINIO=${DOMINIO}|" .env
fi

echo "==> Build"
$DOCKER compose build

if ! grep -q '^CHAVE_ASSINATURA=.\+' .env; then
  echo "==> Chave de assinatura dos certificados"
  CHAVE="$($DOCKER compose run --rm --no-deps -T api python -m app.cli gerar-chave \
           | sed -n 's/^CHAVE_ASSINATURA=//p')"
  [ -n "$CHAVE" ] || { echo "Falha ao gerar a chave"; exit 1; }
  sed -i "s|^CHAVE_ASSINATURA=.*|CHAVE_ASSINATURA=${CHAVE}|" .env
fi

echo "==> Subindo"
$DOCKER compose up -d

echo "==> Backup diário do banco (03:30)"
chmod +x backup.sh atualizar.sh publicar.sh
LINHA="30 3 * * * $(pwd)/backup.sh >> $HOME/backups/backup.log 2>&1"
mkdir -p "$HOME/backups"
# Numa máquina nova não há crontab, e "crontab -l" sai com erro: o "|| true"
# impede o set -e de abortar aqui.
{ { crontab -l 2>/dev/null || true; } | { grep -v 'backup.sh' || true; }; echo "$LINHA"; } | crontab -

cat <<FIM

Pronto: https://${DOMINIO}
O certificado HTTPS pode levar um minuto na primeira vez.

Para o GitHub Actions publicar sozinho, cadastre a chave de deploy
(docs/deploy.md, "Publicação automática").

Próximos passos:
  1. Criar o primeiro admin:
       cd $(pwd) && sudo docker compose exec api python -m app.cli criar-admin
  2. COPIE deploy/.env PARA FORA DO SERVIDOR. Sem a CHAVE_ASSINATURA, nenhum
     certificado emitido volta a validar.
FIM
