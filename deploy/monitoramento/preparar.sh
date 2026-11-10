#!/usr/bin/env bash
# Prepara e sobe o monitoramento na VM (docs/monitoramento.md). Pode rodar de
# novo: não troca senha que já existe nem duplica papel no banco.
#
#   cd ~/Mais_Horas/deploy/monitoramento && ./preparar.sh
#
# Exige o deploy da aplicação com pg_stat_statements carregado (o banco do
# deploy/docker-compose.yml sobe com shared_preload_libraries).
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f ../.env ]]; then
  echo "Não achei deploy/.env: instale a aplicação antes (deploy/instalar.sh)." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  umask 077
  gerar() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-32; }
  cat > .env <<EOF
# Gerado por preparar.sh. Nunca versione este arquivo.
DOMINIO=$(grep -E '^DOMINIO=' ../.env | cut -d= -f2-)
GRAFANA_USUARIO=admin
GRAFANA_SENHA=$(gerar)
POSTGRES_MONITOR_SENHA=$(gerar)
POSTGRES_PAINEL_SENHA=$(gerar)
SENHA_DEMONSTRACAO=$(gerar)
INTENSIDADE_DEMONSTRACAO=1
EOF
  echo "Criado deploy/monitoramento/.env com senhas novas."
fi
set -a; source .env; set +a

# Dois papéis no banco: `monitoramento`, para o exportador (pg_monitor), e
# `painel`, para o Grafana e os relatórios, que só lê a trilha de auditoria e
# as tabelas de uso (de usuarios, só colunas que não são senha). As senhas
# entram como variável do psql, nunca coladas no SQL.
sudo docker compose -f ../docker-compose.yml exec -T banco \
  psql -v ON_ERROR_STOP=1 -q -U maishoras -d mais_horas \
       -v senha_monitor="$POSTGRES_MONITOR_SENHA" -v senha_painel="$POSTGRES_PAINEL_SENHA" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT 'CREATE ROLE monitoramento' WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'monitoramento')\gexec
SELECT 'CREATE ROLE painel' WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = 'painel')\gexec
ALTER ROLE monitoramento WITH LOGIN PASSWORD :'senha_monitor' CONNECTION LIMIT 3;
ALTER ROLE painel WITH LOGIN PASSWORD :'senha_painel' CONNECTION LIMIT 6;
ALTER ROLE painel SET default_transaction_read_only = on;
ALTER ROLE painel SET statement_timeout = '15s';
GRANT pg_monitor TO monitoramento;
GRANT pg_read_all_stats TO painel;
GRANT CONNECT ON DATABASE mais_horas TO monitoramento, painel;
GRANT USAGE ON SCHEMA public TO painel;
GRANT SELECT ON registros_auditoria, atividades, inscricoes, certificados TO painel;
GRANT SELECT (id, nome, email, papel, situacao, criado_em) ON usuarios TO painel;
SQL
echo "Papéis do banco prontos."

sudo docker compose up -d --build
sudo docker image prune -f >/dev/null

echo
echo "Monitoramento no ar em https://${DOMINIO}/monitoramento/"
echo "Usuário: ${GRAFANA_USUARIO}. A senha está em deploy/monitoramento/.env (GRAFANA_SENHA)."
echo "Para o uso simulado: sudo docker compose --profile demonstracao up -d --build simulador"
