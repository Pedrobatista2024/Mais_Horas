# Refatoração do backend — o que mudou e por quê

Registro dos pontos fracos encontrados no backend e como cada um foi resolvido.
Serve como histórico técnico do projeto e como guia do padrão a seguir daqui pra frente.

Legenda: **Feito** — já está no código. **Recomendado** — evolução mapeada, ainda não implementada.

> **Os itens 1 a 10 são história do backend Node/Express**, que foi substituído por
> Python/FastAPI (item 11). Os problemas e as soluções continuam valendo como registro do
> raciocínio — e as decisões de arquitetura que eles descrevem foram preservadas na
> migração — mas o código citado neles não existe mais no repositório.

---

## 1. Validação de entrada — Feito

**Problema:** cada controller validava na mão (`if (!title) ...`), com regras espalhadas,
duplicadas entre `create` e `update`, e sem padrão de resposta de erro.

**Solução:** schemas com **zod** em `src/validators/` + middleware `validate` que roda
antes do controller. Entrada inválida retorna `400` com a lista de campos e mensagens
padronizadas.

```js
router.post("/", authMiddleware, requireRole("organization"),
  validate({ body: createActivitySchema }), createActivity);
```

## 2. Tratamento de erros — Feito

**Problema:** `try/catch` repetido em todo controller, com `console.error` +
`res.status(500)` copiado dezenas de vezes. Mensagens inconsistentes (`error` vs `message`).

**Solução:** o wrapper `asyncHandler` remove o try/catch repetido e o **middleware de erro
central** (`error.middleware.js`) formata toda resposta no mesmo formato
`{ message, details? }`. A classe `AppError` carrega erros de negócio com o status correto.

## 3. Autorização por papel — Feito

**Problema:** qualquer usuário logado conseguia chamar rotas de ONG (criar/finalizar
atividade). A checagem era ad-hoc dentro de alguns controllers
(`activity.createdBy === req.user._id`) e faltava em outros.

**Solução:** middleware `requireRole("organization")` / `requireRole("student")` aplicado
na própria rota. A checagem de dono (ownership) virou helper reutilizável no service.

## 4. Camada de serviço — Feito

**Problema:** controllers gordos misturando HTTP + regra de negócio + acesso a dados
(o `finishActivity` tinha 80 linhas).

**Solução:** `src/services/` concentra a regra (finalizar atividade, gerar certificados,
validar presença). Controllers ficaram finos: validam, chamam o service, devolvem a resposta.

## 5. Segurança — Feito

**Problema:** sem headers de segurança; `cors()` liberado para qualquer origem; login sem
proteção contra força bruta; JWT sem checagem de secret ausente.

**Solução:**

- **helmet** para os headers de segurança
- **express-rate-limit** em `/users/login` e `/users/register` (20 req / 15 min por IP)
- CORS configurável por env (`CORS_ORIGIN`), com fallback liberado em dev
- validação da presença de `JWT_SECRET` no boot — o processo aborta se faltar

## 6. Consistência de dados — Feito

**Problema:** no MongoDB o array `participants` dentro de `Activity` duplicava a informação
que já estava em `Participation`, e os dois podiam divergir.

**Solução (junto com a migração para Postgres):** fonte única de verdade na tabela
`participations`, com `UNIQUE(activity_id, user_id)` e contagem via `COUNT(*)`.
Todas as FKs com `ON DELETE CASCADE`.

## 7. Geração de certificado e verificação — Feito

**Problema:** o código de verificação era só um hash aleatório (`crypto.randomBytes`).
A validação por QR existia, mas a página pública era HTML cru montado por concatenação de
string — risco de injeção e visual pobre.

**Solução:** a página de verificação virou uma rota do **frontend** (`/verificar/:code`),
responsiva, consumindo o endpoint JSON `GET /api/certificates/validate/:code`. O QR do PDF
aponta para essa página.

**Recomendado:** check-in de presença com QR dinâmico. Ver [desafio-tecnico.md](desafio-tecnico.md).

## 8. Uploads — Parcial

**Problema:** fotos salvas em disco local (`uploads/`) — somem a cada deploy no Render,
porque o disco do plano free é efêmero. Sem limpeza de órfãos.

**Solução:** mantido em disco para dev, com a limitação documentada em [deploy.md](deploy.md).

**Recomendado:** storage externo (Cloudinary / S3 / R2) em produção.

## 9. Variáveis de ambiente — Feito

**Problema:** `APP_URL` e `JWT_SECRET` usados sem checagem; `.env` versionável.

**Solução:** `.env.example` documentado, `.gitignore` cobrindo `.env`, checagem do secret
no boot.

## 10. Padrões gerais — Feito

Estrutura de pastas clara (`validators/`, `services/`, `middlewares/`, `utils/`),
respostas de API uniformes, remoção dos `console.log` de debug.

---

## 11. Migração para Python + FastAPI — Feito

O backend Node/Express foi reescrito em **Python + FastAPI**, preservando o contrato da
API para o frontend não precisar mudar de forma.

| Antes (Express) | Depois (FastAPI) |
|---|---|
| zod + middleware `validate` | Pydantic — validação sai do type hint |
| `authMiddleware` | `Depends(get_current_user)` |
| `requireRole("organization")` | `Depends(require_role("organization"))` |
| `asyncHandler` | desnecessário — `async def` nativo |
| `error.middleware.js` | `@app.exception_handler` |
| `helmet` | middleware de headers próprio |
| `express-rate-limit` | dependência `auth_rate_limit` |
| `multer` | `UploadFile` |
| `pdfkit` | `reportlab` |
| `pg` com SQL cru | SQLAlchemy 2.0 async + asyncpg |
| schema no boot | **Alembic** (resolve o item de migrations) |

**O que a migração ganhou de brinde:**

- **Migrations de verdade** com Alembic — a dívida nº 2 desta lista deixou de existir.
- **Documentação OpenAPI automática** em `/docs` e `/redoc`.
- **Teste de fumaça** (`smoke_test.py`) com 68 verificações cobrindo todos os endpoints —
  o projeto saiu de zero cobertura.
- **Autenticação mais forte** (item 12).

**Compatibilidade preservada:** o schema do banco não mudou (só ganhou `refresh_tokens`),
os aliases `_id` continuam, e as senhas bcrypt do backend Node seguem válidas.

## 12. Autenticação: access + refresh — Feito

**Problema:** o backend Node emitia um único JWT de **7 dias**, guardado no `localStorage`.
Três consequências ruins: um XSS lia a sessão inteira; não havia como revogar o token,
nem no logout; e um token vazado valia uma semana.

**Solução:** access token de 15 minutos em memória + refresh token opaco de 7 dias em
cookie `httpOnly`, guardado no banco só como hash, com rotação a cada uso e revogação da
família inteira ao detectar reuso. Senhas passaram para **Argon2id**.

O modelo completo, incluindo a janela de graça que evita derrubar sessão legítima em
requisição concorrente, está em [autenticacao.md](autenticacao.md).

---

## Dívida técnica em aberto

Levantada durante a organização da documentação, ainda não resolvida:

- **Cobertura de teste é rasa.** O `smoke_test.py` cobre o caminho feliz e as travas
  principais dos 25 endpoints, mas não é suíte unitária: não há teste de borda por service,
  nem runner (pytest) configurado.
- **Uploads efêmeros** em produção (item 8). As fotos gravadas em disco somem a cada
  redeploy no plano free do Render. A correção é storage externo (Cloudinary/S3/R2).
- **Rate limit em memória, por processo.** Com mais de um worker o limite vira "20 por
  worker". Corrigir exige contador compartilhado (Redis).
- **Refresh tokens expirados não são limpos** da tabela. Convém uma rotina periódica.
- ~~`frontend/.env` versionado~~ — resolvido: removido do índice e coberto pelo
  `.gitignore` da raiz.

Resolvidos na migração para FastAPI: ausência de migrations, ausência de testes,
`backend/.gitignore` com padrão que não ignorava nada, e o arquivo órfão `backend/cod.js`.
