# CLAUDE.md

Instruções para agentes trabalhando neste repositório.

## O projeto

Mais Horas — plataforma que conecta estudantes e ONGs para horas de extensão, com
certificado validável por QR Code. Monorepo simples: `backend/` (FastAPI + Postgres) e
`frontend/` (React + Vite + Mantine).

## ⚠️ Leia isto antes de escrever código

**O código de hoje e o sistema projetado são coisas diferentes.** Existe uma especificação
completa e aprovada, e o código ainda não foi reescrito para ela.

| | Descreve | Use para |
|---|---|---|
| [especificacao.md](docs/especificacao.md) · [fluxos.md](docs/fluxos.md) · [modelo-dados.md](docs/modelo-dados.md) · [contrato-api.md](docs/contrato-api.md) | **O alvo** — o que construir | **Escrever código novo** |
| [requisitos.md](docs/requisitos.md) · [arquitetura.md](docs/arquitetura.md) · [api.md](docs/api.md) | O código **como está hoje** | Entender o que existe |

**Onde os dois divergem, o alvo manda.** Divergências conhecidas:

| Assunto | Código hoje | Alvo |
|---|---|---|
| Identificador na API | `_id` (herança do MongoDB) | `id` (D29) |
| Formato de erro | `{ message, details }` | `{ codigo, mensagem, detalhes }` |
| Tabelas | inglês (`participations`) | português (`inscricoes`) |
| Rotas | `/api/activities` | `/api/v1/atividades` |
| Situações da atividade | 2 em uso | 4 gravadas + 2 calculadas |

A seção "Backend — padrões obrigatórios" abaixo vale para **os dois**: são regras de
estrutura, não de nomenclatura.

**A travessia é por fatia vertical** — uma funcionalidade completa por vez, do banco à
tela, mantendo o sistema sempre utilizável. A ordem das fatias e a definição de pronto
estão em [plano-execucao.md](docs/plano-execucao.md). Consulte antes de começar qualquer
implementação.

## Comandos

```bash
docker compose up -d                          # Postgres local na porta 5433
cd backend && alembic upgrade head            # aplica migrations
cd backend && uvicorn app.main:app --reload --port 3000
cd backend && pytest                          # suíte de testes
cd frontend && npm run dev                    # SPA em :5173
cd frontend && npm run build                  # precisa passar limpo antes de finalizar
cd frontend && npm run lint                   # eslint, precisa passar sem erros
```

O backend usa venv em `backend/.venv`. Ative antes, ou chame o Python de lá direto.

**Primeira vez no projeto:**

```bash
cd backend && cp .env.example .env && python -m app.cli gerar-segredos && python -m app.cli gerar-chave
```

Cole os valores no `.env`. Sem `JWT_SECRET` e `CHECKIN_SECRET` a API se recusa a subir; sem
`CHAVE_ASSINATURA` ela sobe, mas não emite certificado.

Os testes usam **banco separado** (`DATABASE_URL_TESTE`), criado com:

```bash
docker exec mais-horas-pg psql -U postgres -c "CREATE DATABASE mais_horas_teste;"
```

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

5. **Toda resposta de erro sai pelos handlers de `app/core/errors.py`.** Nunca monte
   formato novo no router. *(Hoje o formato é `{ message, details }`; no alvo passa a ser
   `{ codigo, mensagem, detalhes }` — ver contrato-api.md.)*

6. **O formato de saída é responsabilidade de `app/utils/serialize.py`.** A tradução entre
   o banco e o JSON mora lá e em nenhum outro lugar. *(Hoje traduz para `_id` e camelCase;
   no alvo o campo é `id`.)*

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

**Invariantes que não podem ser quebradas** — valem no código atual e no alvo, só mudam
de nome (hoje em inglês, no alvo em português):

- A tabela de inscrição é a **fonte única de verdade**. Nunca crie array de participantes
  dentro da atividade.
- **Uma inscrição por aluno e atividade**, garantida por `UNIQUE` no banco.
- **Um certificado por inscrição**, garantido por `UNIQUE` no banco.
- Atividade **não finaliza** com participação sem decisão de presença.
- A tabela de refresh guarda **hash**, nunca o token em claro.

O alvo acrescenta: certificado sempre assinado, auditoria somente de inserção, e só
rascunho pode ser excluído. Ver [modelo-dados.md](docs/modelo-dados.md).

## Antes de finalizar

- `cd backend && pytest` — tudo verde.
- `cd frontend && npm run build && npm run lint` — ambos limpos.

## Documentação

Ao mudar algo estrutural, atualize o doc correspondente:

**Desenho do alvo** — atualize ao decidir algo novo:

| Mudou | Atualize |
|---|---|
| Ordem de implementação, fatia | [plano-execucao.md](docs/plano-execucao.md) |
| Comportamento, tela, botão, estado | [especificacao.md](docs/especificacao.md) |
| Caminho de uso, erro tratado, cenário | [fluxos.md](docs/fluxos.md) |
| Tabela, coluna, restrição, índice | [modelo-dados.md](docs/modelo-dados.md) |
| Endpoint, payload, código de erro | [contrato-api.md](docs/contrato-api.md) |

**Retrato do código atual** — atualize ao mexer no que já existe:

| Mudou | Atualize |
|---|---|
| Pastas, componentes, rotas de tela | [arquitetura.md](docs/arquitetura.md) |
| Endpoint existente | [api.md](docs/api.md) |
| Regra ou lacuna do sistema atual | [requisitos.md](docs/requisitos.md) |

**Transversais** — valem para os dois:

| Mudou | Atualize |
|---|---|
| Login, token, sessão | [autenticacao.md](docs/autenticacao.md) |
| Env, build, deploy | [deploy.md](docs/deploy.md) |
| Padrão do backend, dívida técnica | [backend-refactor.md](docs/backend-refactor.md) |
| Estratégia de certificado ou presença | [desafio-tecnico.md](docs/desafio-tecnico.md) |

O PDF entregue na faculdade é gerado por [docs/requisitos-abnt/](docs/requisitos-abnt/).
Ao mudar uma regra de negócio, atualize o script de lá também.

## Dívida técnica conhecida

Registrada em [docs/backend-refactor.md](docs/backend-refactor.md) — não são regressões,
são pendências mapeadas: cobertura de teste rasa (só smoke test, sem pytest), uploads
efêmeros em produção e rate limit em memória por processo.

A maior pendência, porém, é a distância entre o código atual e o desenho aprovado — ver o
aviso no topo deste arquivo.
