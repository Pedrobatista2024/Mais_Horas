# CLAUDE.md

Instruções para agentes trabalhando neste repositório.

## O projeto

Mais Horas — plataforma que conecta estudantes e ONGs para horas de extensão, com
certificado validável por QR Code. Monorepo simples: `backend/` (Express + Postgres) e
`frontend/` (React + Vite + Mantine).

Antes de mexer em qualquer coisa, vale ler [docs/arquitetura.md](docs/arquitetura.md).

## Comandos

```bash
docker compose up -d              # Postgres local na porta 5433
cd backend && npm run dev         # API em :3000 (nodemon)
cd frontend && npm run dev        # SPA em :5173
cd frontend && npm run build      # precisa passar limpo antes de finalizar
cd frontend && npm run lint       # eslint, precisa passar sem erros
```

Não há testes no backend — `backend/tests/` está vazio.

## Idioma

Código e documentação em **português**: nomes de variáveis de domínio, comentários,
mensagens de erro da API e textos de interface. Nomes técnicos consagrados ficam em inglês
(`createActivity`, `requireRole`, `status: "present"`).

## Backend — padrões obrigatórios

O fluxo de toda requisição é fixo. Não pule etapas:

```
rota -> authMiddleware -> requireRole -> validate(zod) -> controller -> service -> model
```

1. **Validação sempre em `src/validators/` com zod**, aplicada na rota via
   `validate({ body, params, query })`. Nunca validar dentro do controller com `if (!campo)`.

2. **Autorização sempre na rota** com `requireRole("student" | "organization")`.
   Checagem de dono (ownership) fica em helper do service, não espalhada no controller.

3. **Controllers são finos.** Recebem, chamam o service, respondem. Se um controller passou
   de ~20 linhas, a regra pertence ao service.

4. **Nunca `try/catch` no controller.** Use `asyncHandler` e deixe o erro subir para o
   `errorHandler` central. Para erro de negócio, lance `AppError` com o status correto:

   ```js
   throw new AppError("Atividade não encontrada", 404);
   ```

5. **Toda resposta de erro sai como `{ message, details? }`** — o middleware central cuida
   disso. Não invente formatos novos nem use a chave `error`.

6. **SQL fica em `src/models/`.** Sempre com query parametrizada (`$1`, `$2`), nunca
   concatenando string.

7. **Não adicione `console.log` de debug.** Log de erro real é responsabilidade do
   `errorHandler`.

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

## Banco de dados

Schema criado no boot por `CREATE TABLE IF NOT EXISTS` em `backend/src/config/database.js`.
**Não há migrations.**

Ao alterar o schema, lembre que a mudança só se aplica sozinha em banco novo. Adicionar
coluna em base existente exige `ALTER TABLE` manual — sinalize isso ao usuário quando
propor uma mudança de schema.

Invariantes que não podem ser quebradas:

- `participations` é a fonte única de verdade da inscrição. Não crie array de participantes
  dentro de `activities`.
- `UNIQUE(activity_id, user_id)` em `participations` — sem inscrição duplicada.
- `participation_id UNIQUE` em `certificates` — um certificado por participação.
- Atividade não finaliza com participação `pending`.

A API expõe o `id` também como `"_id"` (alias, herança do MongoDB). Manter, o frontend depende.

## Documentação

Ao mudar algo estrutural, atualize o doc correspondente:

| Mudou | Atualize |
|---|---|
| Pastas, componentes, rotas de tela, schema | [docs/arquitetura.md](docs/arquitetura.md) |
| Endpoint, payload, regra de acesso | [docs/api.md](docs/api.md) |
| Env, build, deploy | [docs/deploy.md](docs/deploy.md) |
| Padrão do backend, dívida técnica | [docs/backend-refactor.md](docs/backend-refactor.md) |
| Estratégia de certificado ou presença | [docs/desafio-tecnico.md](docs/desafio-tecnico.md) |

## Dívida técnica conhecida

Registrada em [docs/backend-refactor.md](docs/backend-refactor.md) — não são regressões,
são pendências mapeadas: sem testes, sem migrations, uploads efêmeros em produção,
`frontend/.env` versionado, padrão errado no `backend/.gitignore`.
