# Mais Horas

Plataforma que conecta **estudantes** e **ONGs**: as ONGs publicam vagas de voluntariado
(como ofertas de trabalho), os estudantes se inscrevem para cumprir horas de extensão, e a
presença confirmada gera um **certificado validável por QR Code**.

## Stack

| Camada | Tecnologias |
|---|---|
| **Backend** | Node + Express, `pg` (PostgreSQL nativo), zod, helmet, express-rate-limit, JWT |
| **Frontend** | React 19 + Vite + Mantine v8, react-router, axios |
| **Banco** | PostgreSQL 16 (UUID, JSONB para perfis) |
| **Deploy** | Render (blueprint em `render.yaml`) |

## Rodar local

Precisa de Node 18+ e Docker.

**1. Banco**

```bash
docker compose up -d
```

Sobe o Postgres na porta **5433** do host.

**2. Backend**

```bash
cd backend && cp .env.example .env && npm install && npm run dev
```

Roda em `http://localhost:3000`. As tabelas são criadas automaticamente no primeiro boot.

> O servidor **aborta se `JWT_SECRET` não estiver definido** no `.env`. O `.env.example`
> já traz um valor de exemplo — troque por uma string aleatória longa.

**3. Frontend**

```bash
cd frontend && cp .env.example .env && npm install && npm run dev
```

Roda em `http://localhost:5173`.

## Documentação

| Documento | O que contém |
|---|---|
| [docs/arquitetura.md](docs/arquitetura.md) | Estrutura de pastas, rotas de tela, schema do banco |
| [docs/api.md](docs/api.md) | Referência dos endpoints: acesso, payload, formato de erro |
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
backend/         API Express (ver docs/arquitetura.md)
frontend/        SPA React + Vite + Mantine
docs/            documentação técnica
presentation/    slides, PDF e roteiro da apresentação
logo/            SVGs da marca
scripts/         gerador PowerShell da apresentação
docker-compose.yml   Postgres local
render.yaml          blueprint de deploy
```
