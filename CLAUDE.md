# CLAUDE.md

Instruções para agentes trabalhando neste repositório.

## O projeto

Mais Horas — plataforma que conecta estudantes e ONGs para horas de extensão, com
certificado validável por QR Code. Monorepo simples: `backend/` (FastAPI + Postgres) e
`frontend/` (React + Vite + Mantine).

Antes de mexer em qualquer coisa, vale ler [docs/arquitetura.md](docs/arquitetura.md).

## Comandos

```bash
docker compose up -d                          # Postgres local na porta 5433
cd backend && alembic upgrade head            # aplica migrations
cd backend && uvicorn app.main:app --reload --port 3000
cd backend && python smoke_test.py            # 68 verificações ponta a ponta
cd frontend && npm run dev                    # SPA em :5173
cd frontend && npm run build                  # precisa passar limpo antes de finalizar
cd frontend && npm run lint                   # eslint, precisa passar sem erros
```

O backend usa venv em `backend/.venv`. Ative antes, ou chame o Python de lá direto.

## Idioma

Código e documentação em **português**: nomes de variáveis de domínio, comentários,
mensagens de erro da API e textos de interface. Nomes técnicos consagrados ficam em inglês
(`create_activity`, `require_role`, `status: "present"`).

## Backend — padrões obrigatórios

O fluxo de toda requisição é fixo. Não pule etapas:

```
rota -> Depends(get_current_user) -> Depends(require_role) -> Pydantic -> service -> SQLAlchemy
```

1. **Validação sempre em `app/schemas/` com Pydantic**, declarada como type hint do
   endpoint. Nunca validar dentro do handler com `if not campo`.

2. **Autorização sempre na assinatura da rota**, via `OrgUser` / `StudentUser` / `CurrentUser`
   de `app/core/deps.py`. Checagem de dono (ownership) fica em helper do service.

3. **Routers são finos.** Recebem, chamam o service, respondem. Se um handler passou de
   ~20 linhas, a regra pertence a `app/services/`.

4. **Nunca `try/except` para virar resposta HTTP.** Lance `AppError` e deixe o handler
   central formatar:

   ```python
   raise AppError("Atividade não encontrada", status.HTTP_404_NOT_FOUND)
   ```

5. **Toda resposta de erro sai como `{ message, details? }`** — os handlers em
   `app/core/errors.py` cuidam disso. Não invente formatos novos.

6. **O formato de saída é responsabilidade de `app/utils/serialize.py`.** O frontend espera
   `_id` e camelCase; a tradução mora lá e em nenhum outro lugar.

7. **Nada de SQL cru.** Use SQLAlchemy. Se precisar de SQL literal numa migration, passe
   por `run_script()` — o asyncpg recusa múltiplos comandos num prepared statement.

8. **Não adicione `print` de debug.** Log de erro real é do `errorHandler`.

## Frontend — padrões obrigatórios

**Antes de criar ou editar qualquer tela, leia a skill
[`.claude/skills/frontend-maishoras/SKILL.md`](.claude/skills/frontend-maishoras/SKILL.md).**
Ela tem a paleta, o catálogo de componentes reutilizáveis e as regras de responsividade.

O resumo curto:

- **Sempre Mantine.** Sem Tailwind, sem HTML cru estilizado com `style` inline solto.
- **Reaproveite `src/components/ui/`** antes de criar componente novo (`PageHeader`,
  `StatCard`, `ActivityCard`, `EmptyState`, `Loading`, `StatusBadge`, `InfoItem`...).
- **GET com `useFetch`**, mutations com o `api` de `src/services/api`.
- **Sempre trate `loading` com `<Loading />`** e lista vazia com `<EmptyState />`.
- **Feedback com `notifySuccess` / `notifyError`.** Nunca `alert()`.
- **Responsivo é obrigatório** — a maioria dos alunos acessa por celular. Teste em 375px.

## Sessão — não quebre estas regras

Leia [docs/autenticacao.md](docs/autenticacao.md) antes de mexer em qualquer coisa de login.

- **O access token nunca vai para o `localStorage`.** Ele vive em memória, em
  `services/api.js`. Persistir o token desfaz a proteção contra XSS.
- **O refresh token nunca aparece no corpo da resposta.** Só no cookie `httpOnly`.
- **Só um refresh em voo por vez.** Use `refreshSession()`, que compartilha a promessa.
  Chamar `/users/refresh` direto, em paralelo, derruba a sessão do usuário — o backend
  rotaciona e trata reapresentação como possível roubo.
- **`withCredentials: true`** é obrigatório no axios, senão o cookie não viaja.

## Banco de dados

Schema versionado com **Alembic** em `backend/alembic/versions/`.

Ao mudar o schema: gere a migration, e lembre que as existentes usam
`CREATE TABLE IF NOT EXISTS` para funcionarem tanto em banco novo quanto num que já rodou
o backend Node antigo.

Invariantes que não podem ser quebradas:

- `participations` é a fonte única de verdade da inscrição. Não crie array de participantes
  dentro de `activities`.
- `UNIQUE(activity_id, user_id)` em `participations` — sem inscrição duplicada.
- `participation_id UNIQUE` em `certificates` — um certificado por participação.
- Atividade não finaliza com participação `pending`.
- `refresh_tokens` guarda **hash**, nunca o token em claro.

A API expõe o `id` também como `"_id"` (alias, herança do MongoDB). Manter, o frontend depende.

## Antes de finalizar

- `cd backend && python smoke_test.py` — as 68 verificações precisam passar.
- `cd frontend && npm run build && npm run lint` — ambos limpos.

## Documentação

Ao mudar algo estrutural, atualize o doc correspondente:

| Mudou | Atualize |
|---|---|
| Comportamento novo, tela, botão, estado | [docs/especificacao.md](docs/especificacao.md) |
| Regra de negócio, permissão de perfil, fluxo | [docs/requisitos.md](docs/requisitos.md) |
| Pastas, componentes, rotas de tela, schema | [docs/arquitetura.md](docs/arquitetura.md) |
| Endpoint, payload, regra de acesso | [docs/api.md](docs/api.md) |
| Login, token, sessão | [docs/autenticacao.md](docs/autenticacao.md) |
| Env, build, deploy | [docs/deploy.md](docs/deploy.md) |
| Padrão do backend, dívida técnica | [docs/backend-refactor.md](docs/backend-refactor.md) |
| Estratégia de certificado ou presença | [docs/desafio-tecnico.md](docs/desafio-tecnico.md) |

## Dívida técnica conhecida

Registrada em [docs/backend-refactor.md](docs/backend-refactor.md) — não são regressões,
são pendências mapeadas: cobertura de teste rasa (só smoke test, sem pytest), uploads
efêmeros em produção, rate limit em memória por processo, e `frontend/.env` versionado.
