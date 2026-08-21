# Mais Horas

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
| **Deploy** | Render (blueprint em `render.yaml`) |

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

O backend tem um teste de fumaça que exercita os 25 endpoints ponta a ponta — cadastro,
login, rotação de sessão, atividade, presença, certificado e verificação por QR:

```bash
cd backend && python smoke_test.py
```

Exige o Postgres no ar. São 68 verificações; qualquer falha sai com código 1.

## Documentação

| Documento | O que contém |
|---|---|
| [docs/requisitos.md](docs/requisitos.md) | Requisitos, regras de negócio, casos de uso e fluxos por perfil |
| [docs/arquitetura.md](docs/arquitetura.md) | Estrutura de pastas, rotas de tela, schema do banco |
| [docs/api.md](docs/api.md) | Referência dos endpoints: acesso, payload, formato de erro |
| [docs/autenticacao.md](docs/autenticacao.md) | Como funciona a sessão: tokens, rotação, detecção de roubo |
| [docs/desafio-tecnico.md](docs/desafio-tecnico.md) | O problema difícil do projeto e a proposta de QR dinâmico |
| [docs/backend-refactor.md](docs/backend-refactor.md) | Histórico das melhorias do backend e dívida técnica aberta |
| [docs/deploy.md](docs/deploy.md) | Deploy no Render, variáveis de ambiente, limitações |
| [presentation/roteiro.md](presentation/roteiro.md) | Roteiro da apresentação do projeto de extensão |

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
