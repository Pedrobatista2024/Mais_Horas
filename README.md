# Mais Horas

[![CI / Deploy](https://github.com/Pedrobatista2024/Mais_Horas/actions/workflows/ci.yml/badge.svg)](https://github.com/Pedrobatista2024/Mais_Horas/actions/workflows/ci.yml)

**No ar:** https://maishoras.northcentralus.cloudapp.azure.com — todo push no `main` com
testes verdes é publicado sozinho ([docs/deploy.md](docs/deploy.md)).

Plataforma que conecta **estudantes** e **ONGs**: as ONGs publicam vagas de voluntariado
(como ofertas de trabalho), os estudantes se inscrevem para cumprir horas de extensão, e a
presença confirmada gera um **certificado validável por QR Code**.

## Stack

| Camada | Tecnologias |
|---|---|
| **Backend** | Python + FastAPI, SQLAlchemy 2.0 (async) + asyncpg, Alembic, Pydantic v2 |
| **Autenticação** | JWT access token curto + refresh token rotativo em cookie httpOnly, senhas em Argon2id |
| **Frontend** | React 19 + Vite + Mantine v8, react-router, axios |
| **Banco** | PostgreSQL 16 (UUID, JSONB para perfis) |
| **Testes** | pytest (432 testes) + ESLint e build do Vite, todos na esteira do GitHub Actions |
| **Deploy** | Servidor próprio: Docker + Caddy (HTTPS automático) numa VM Linux. Blueprint do Render fica como alternativa |

## Rodar local

Precisa de Python 3.12+, Node 18+ e Docker.

**1. Banco**

```bash
docker compose up -d
```

Sobe o Postgres na porta **5433** do host.

**2. Backend**

```bash
cd backend && python -m venv .venv && .venv/Scripts/activate && pip install -r requirements.txt
```

No Linux/macOS o activate é `source .venv/bin/activate`.

Depois configure o ambiente e crie as tabelas:

```bash
cp .env.example .env && alembic upgrade head && uvicorn app.main:app --reload --port 3000
```

Roda em `http://localhost:3000`. A documentação interativa da API fica em
`http://localhost:3000/docs`.

> O servidor **aborta se `JWT_SECRET` não estiver definido** no `.env`. Gere um valor com
> `python -c "import secrets; print(secrets.token_urlsafe(64))"`.

**3. Frontend**

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

Roda em `http://localhost:5173`.

## Testes

```bash
cd backend && pytest -q          # 432 testes; exige o Postgres no ar
cd frontend && npx eslint src    # sem erros
cd frontend && npm run build     # precisa passar limpo
```

Os testes usam um banco separado (`mais_horas_teste`), recriado no começo da sessão. Cada
teste roda numa transação revertida ao final, então a ordem não importa.

A esteira do GitHub Actions roda os três a cada push. **Só com tudo verde o `main` é
publicado em produção** — o servidor busca o commit testado e se atualiza sozinho.

## Documentação

| Documento | O que contém |
|---|---|
| [docs/plano-execucao.md](docs/plano-execucao.md) | **Como construir** — as fatias, a ordem e a definição de pronto |
| [docs/especificacao.md](docs/especificacao.md) | **O sistema que estamos construindo** — atores, estados, telas, botões e regras |
| [docs/fluxos.md](docs/fluxos.md) | Todos os caminhos do sistema: feliz, alternativos e de erro, por perfil |
| [docs/modelo-dados.md](docs/modelo-dados.md) | Tabelas, restrições, índices e o plano de migrations |
| [docs/contrato-api.md](docs/contrato-api.md) | Endpoints por perfil, payloads, códigos de erro e catálogo de auditoria |
| [docs/arquitetura.md](docs/arquitetura.md) | Estrutura de pastas, rotas de tela, schema do banco |
| [docs/autenticacao.md](docs/autenticacao.md) | Como funciona a sessão: tokens, rotação, detecção de roubo |
| [docs/desafio-tecnico.md](docs/desafio-tecnico.md) | O problema difícil do projeto: presença que não se falsifica |
| [docs/deploy.md](docs/deploy.md) | Servidor, publicação automática, variáveis de ambiente, backup |
| [docs/historico/](docs/historico/) | A versão anterior do sistema: requisitos, API e a auditoria com as 10 lacunas |
| [presentation/roteiro.md](presentation/roteiro.md) | Roteiro da apresentação do projeto de extensão |
| [presentation/Mais_Horas_Documento_de_Requisitos.pdf](presentation/Mais_Horas_Documento_de_Requisitos.pdf) | Documento de requisitos em ABNT, entregue na faculdade ([gerador](docs/requisitos-abnt/)) |

Convenções de código do frontend estão na skill
[`.claude/skills/frontend-maishoras/SKILL.md`](.claude/skills/frontend-maishoras/SKILL.md).

## O diferencial

Qualquer plataforma consegue listar vagas de voluntariado. O problema difícil é **provar
que a hora complementar é verdadeira** — que o aluno esteve presente e que o certificado
não foi forjado.

Cada certificado tem um código único e uma página pública `/verificar/:code` acessível por
QR Code, que confirma estudante, atividade, ONG e horas consultando o banco — sem depender
do PDF, que poderia ser editado. A evolução proposta é o **check-in por QR dinâmico**, que
rotaciona a cada poucos segundos para impedir que o aluno ausente registre presença com um
print enviado por um colega.

O raciocínio completo está em [docs/desafio-tecnico.md](docs/desafio-tecnico.md).

## Estrutura do repositório

```
backend/         API FastAPI (ver docs/arquitetura.md)
frontend/        SPA React + Vite + Mantine
docs/            documentação técnica
presentation/    slides, PDF e roteiro da apresentação
logo/            SVGs da marca
scripts/         gerador PowerShell da apresentação
docker-compose.yml   Postgres local
render.yaml          blueprint de deploy
```
