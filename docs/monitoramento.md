# Monitoramento

Como saber, a qualquer hora, se o Mais Horas está no ar, se está rápido e se alguém está
tentando entrar à força. Tudo roda na mesma VM da aplicação, mas num projeto Docker
separado: dá para subir, derrubar e apagar o monitoramento sem tocar no site.

```
              internet
                 │
        ┌────────▼────────┐  /monitoramento   ┌──────────┐  consulta  ┌────────────┐
        │  Caddy (web)    ├──────────────────►│ Grafana  ├───────────►│ Prometheus │
        └───┬─────────┬───┘                   └────┬─────┘            └─────┬──────┘
   /api     │         │ /monitoramento/relatorios  │ lê (papel painel)      │ coleta a cada 15 s
        ┌───▼───┐  ┌──▼─────────┐                  │                        │
        │  API  │  │ Relatórios ├──────────────────┤          ┌─────────────┼──────────────┐
        └───┬───┘  └────────────┘                  │          │             │              │
            │ /metrics (rede interna)              │   API /metrics   node-exporter   cAdvisor
        ┌───▼────┐◄────────────────────────────────┘   postgres-exporter   blackbox (de fora)
        │ banco  │
        └────────┘
```

| Peça | O que faz |
|---|---|
| **Prometheus** | O banco de séries temporais: coleta tudo a cada 15 s e guarda 90 dias (até 5 GB). Avalia os alertas |
| **Grafana** | Os seis painéis, em `https://<domínio>/monitoramento`, com login próprio |
| **API do Mais Horas** | Expõe `/metrics` na rede interna: tempo e status de cada rota, eventos da auditoria, bloqueios por excesso de tentativas, verificações de certificado, conexões do pool |
| **node-exporter** | A máquina: CPU, memória, disco, rede |
| **cAdvisor** | Cada container: quem está gastando CPU e memória |
| **postgres-exporter** | O banco: conexões, transações, cache, travas, deadlocks e as consultas mais pesadas (`pg_stat_statements`) |
| **blackbox** | Visão de fora: abre o site pela internet, por HTTPS, a cada 30 s, e mede a validade do certificado |
| **relatórios** | Gera o PDF com comparativo entre períodos, que o Grafana gratuito não faz |
| **simulador** | Uso simulado para demonstração. Só sobe com `--profile demonstracao` |

## Por que Prometheus e Grafana, e não Zabbix

O Zabbix nasceu para monitorar máquinas e equipamentos de rede: agente em cada host,
SNMP, inventário. O que mais importa aqui está dentro da aplicação, como quantos logins
falharam e qual rota ficou lenta, e é para isso que o Prometheus foi feito: a própria API
expõe os números e ele coleta. Ele também é mais leve (a VM tem 4 GB e já roda o site e
outro projeto). E o par Prometheus e Grafana é o padrão de mercado para esse tipo de
painel. O Zabbix ainda precisaria de um servidor, de um banco próprio e de um frontend PHP
para entregar menos do que precisamos.

## Os painéis

Todos ficam na pasta **Mais Horas** do Grafana, e o primeiro abre sozinho.

| Painel | Para responder |
|---|---|
| **Saúde do Mais Horas** | Está no ar? Está rápido? Tem alerta disparado? (a tela inicial) |
| **API: desempenho e erros** | Qual rota é mais chamada, qual é mais lenta, qual está falhando |
| **Segurança e acessos** | Logins aceitos e recusados, força bruta, IPs e contas mais visadas, sessão roubada, QR inválido |
| **Banco de dados** | Conexões, transações, cache, travas, consultas que mais pesam, tamanho das tabelas |
| **Servidor e containers** | CPU, memória, disco, rede e o consumo de cada container |
| **Uso da plataforma** | Contas, inscrições, check-ins e certificados ao longo do tempo |

Os painéis são gerados por `deploy/monitoramento/grafana/gerar_paineis.py`. O Grafana não
aceita edição pela tela: para mudar um painel, mude o gerador, rode-o e faça o deploy.

```bash
python deploy/monitoramento/grafana/gerar_paineis.py
```

### Níveis

Cada indicador tem três níveis, com as mesmas regras nos painéis, nos alertas e no PDF:

| Nível | Cor | Quer dizer |
|---|---|---|
| OK | verde | Dentro do esperado |
| Atenção | âmbar | Saiu do normal; vale olhar hoje |
| Crítico | vermelho | Usuário afetado ou ataque em curso; olhar agora |

Alguns limites, para ter ideia:

| Indicador | Atenção | Crítico |
|---|---|---|
| Disponibilidade vista de fora | abaixo de 99,5% | abaixo de 95% |
| Tempo de resposta (p95) | acima de 0,5 s | acima de 1 s |
| Erros 5xx | acima de 1% | acima de 5% |
| Logins recusados por dia | 50 | 200 |
| Taxa de recusa de login | 20% | 50% |
| Bloqueio por força bruta | 1 por dia | 50 por dia |
| Sessão roubada detectada | | 1 |
| CPU | 70% | 85% |
| Memória | 80% | 90% |
| Disco | 80% | 92% |

## Alertas

Ficam em `deploy/monitoramento/prometheus/alertas.yml`: 22 regras em cinco grupos
(disponibilidade, desempenho, segurança, banco, servidor). Cada uma leva o rótulo `nivel`
(`atencao` ou `critico`) e um `titulo` em português, que o painel inicial mostra na tabela
**Alertas ativos** e o relatório lista com o tempo que ficou disparada.

Os de segurança são os que mais aparecem numa demonstração:

- **Possível força bruta**: algum IP passou de 20 logins em 15 minutos e está sendo barrado.
- **Muitas falhas de login**: mais de 15 recusas em 10 minutos, mesmo espalhadas entre IPs.
- **Sessão roubada**: um refresh token já usado voltou depois da janela de 15 s
  ([autenticacao.md](autenticacao.md)).
- **Varredura de certificados**: algum IP passou de 60 verificações por minuto.
- **Certificado adulterado**: a assinatura de um certificado não conferiu com o registro.
- **Muitos QR inválidos**: mais de 5 check-ins com código vencido em 15 minutos, típico de
  print do QR circulando.

Hoje os alertas aparecem no Grafana e no relatório. Mandar para Telegram, Discord ou
e-mail é um passo seguinte: basta um ponto de contato no Grafana ou um Alertmanager.

## O relatório em PDF

Em **Relatório em PDF**, no topo de qualquer painel (ou em
`/monitoramento/relatorios/`), escolha 24 horas, 7 ou 30 dias. O PDF traz:

1. A **situação geral**: o pior nível entre os indicadores, numa frase.
2. **Indicadores** com valor do período, do período anterior de mesma duração, a variação
   e o nível de cada um.
3. **Gráficos** do período, com o anterior tracejado por baixo para comparar.
4. **Alertas** que dispararam e por quanto tempo.
5. **Segurança**: IPs e contas com mais logins recusados.
6. **Rotas mais lentas** e **consultas mais pesadas** do banco.

O serviço fica atrás do Caddy, que só deixa passar quem tem sessão aberta no Grafana
(`forward_auth`): sem login, a resposta é `401`.

## O que a API mede

`backend/app/core/metricas.py`. A rota `/metrics` responde só pela rede interna do Docker:
o Caddy não a repassa e ela recusa quem chega com `X-Forwarded-For`.

| Métrica | O quê |
|---|---|
| `maishoras_http_requisicoes_total{metodo, rota, status}` | Requisições respondidas |
| `maishoras_http_duracao_segundos{metodo, rota}` | Tempo de resposta (histograma) |
| `maishoras_http_em_andamento` | Requisições sendo atendidas agora |
| `maishoras_eventos_total{acao}` | Cada ação gravada na auditoria (`sessao.falha`, `checkin.registrado`...) |
| `maishoras_limite_excedido_total{balde}` | Barradas pelo limite de tentativas (`auth`, `verificacao`) |
| `maishoras_certificado_verificacoes_total{desfecho}` | Verificações públicas: válido, revogado, adulterado, inexistente |
| `maishoras_banco_conexoes{estado}` | Pool de conexões da API com o banco |

A rota entra pelo **molde** (`/api/v1/atividades/{atividade_id}`), nunca pelo caminho
real: um id na URL não pode virar série nova. Caminho sem rota vira `nao_encontrada`.

Os eventos de negócio saem de `auditoria.registrar()`, onde toda ação relevante já passa.
O contador conta a tentativa: se a transação de quem chamou for desfeita, a linha da trilha
some e o contador fica.

## O banco, visto pelo monitoramento

O `preparar.sh` cria dois papéis no Postgres:

- `monitoramento`, com `pg_monitor`, para o exportador;
- `painel`, só leitura (`default_transaction_read_only`, 15 s de limite por consulta), para
  o Grafana e o relatório. Lê a trilha de auditoria e as tabelas de uso; de `usuarios`, só
  `id, nome, email, papel, situacao, criado_em`. **Nunca a senha.**

O banco da aplicação sobe com `pg_stat_statements` (`deploy/docker-compose.yml`), que
guarda tempo e contagem de cada consulta. É a fonte da tabela "Consultas que mais consomem
tempo", que aponta o que deixa o sistema lento.

## Operar

Primeira vez, na VM, depois do deploy da aplicação:

```bash
cd ~/Mais_Horas/deploy/monitoramento
./preparar.sh
```

Ele gera `deploy/monitoramento/.env` com senhas novas (nunca versionado), cria os papéis
do banco e sobe tudo. Rodar de novo não troca senha nem duplica papel. A senha do Grafana
fica nesse `.env`, em `GRAFANA_SENHA`:

```bash
grep GRAFANA_SENHA ~/Mais_Horas/deploy/monitoramento/.env
```

Depois de mudar painel, alerta ou relatório no repositório:

```bash
cd ~/Mais_Horas/deploy/monitoramento && sudo docker compose up -d --build
```

O Grafana relê os painéis sozinho em até um minuto; o Prometheus relê os alertas ao
reiniciar (`sudo docker compose restart prometheus`).

Desligar tudo, mantendo o histórico: `sudo docker compose down`. Apagar também o histórico:
`sudo docker compose down -v`.

## Dados de demonstração

O simulador (`deploy/monitoramento/simulador/simulador.py`) gera uso realista **pela API**,
pelas mesmas rotas e regras que o site usa. Métricas, trilha de auditoria e certificados
são de verdade; o que é simulado é quem está do outro lado:

- cinco ONGs e trinta e seis estudantes, com e-mail em `@demonstracao.mais-horas.org`;
- visitantes navegando pela vitrine, alunos entrando (às vezes errando a senha), se
  inscrevendo e baixando certificado, ONGs aprovando inscrições;
- até três atividades por dia, entre 8h e 18h, no relógio de verdade: a ONG cria a vaga,
  alunos se inscrevem, fazem check-in pelo token do QR durante a janela (alguns com o
  "print" vencido) e, no fim, a ONG valida a presença e o certificado sai assinado;
- incidentes: força bruta numa conta, lista de e-mails sendo testada, varredura de códigos
  de certificado e reuso de token de sessão. Um de cada logo depois de subir, depois dois
  ou três por dia.

Cada pessoa tem um IP fixo das faixas reservadas para documentação (RFC 5737:
`192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24`), que nunca pertencem a ninguém.

```bash
cd ~/Mais_Horas/deploy/monitoramento
sudo docker compose --profile demonstracao up -d --build simulador   # ligar
sudo docker compose --profile demonstracao stop simulador            # pausar
```

**Para remover tudo o que ele criou**, primeiro pare o simulador e depois:

```bash
cd ~/Mais_Horas/deploy
sudo docker compose exec api python -m app.cli remover-demonstracao             # só conta
sudo docker compose exec api python -m app.cli remover-demonstracao --confirmar  # apaga
```

Saem as contas do domínio de demonstração e, em cascata, atividades, inscrições,
certificados e avisos. Da trilha de auditoria saem só as linhas marcadas: ator ou entidade
de demonstração, ou IP de uma das três faixas. É a única exceção à regra de que a trilha
não se apaga, por isso fica fora de qualquer rota, pede `--confirmar` e deixa o próprio
registro (`sistema.demonstracao_removida`). Uma pessoa de verdade que tenha se inscrito
numa vaga de demonstração perde essa inscrição junto com a vaga.

O histórico do Prometheus continua: ele mede o que aconteceu no servidor, e aquilo
aconteceu.

## Limitações

- **Tudo na mesma VM.** Se a máquina cair, o monitoramento cai junto, e quem avisa é só
  quem tentar abrir o site. A sonda de fora (blackbox) mora no mesmo lugar; para uma visão
  independente de verdade, um serviço externo de uptime (UptimeRobot, por exemplo)
  completaria.
- **Alerta só na tela.** Ainda não há notificação por mensagem.
- **O contador de tentativas é por processo** (dívida de [autenticacao.md](autenticacao.md)),
  então o alerta de força bruta vale para a instância única de hoje.
- **`pg_stat_statements` acumula desde o último reinício** do banco, não por período.
