# Refatoração do backend — o que mudou e por quê

Registro dos pontos fracos encontrados no backend e como cada um foi resolvido.
Serve como histórico técnico do projeto e como guia do padrão a seguir daqui pra frente.

Legenda: **Feito** — já está no código. **Recomendado** — evolução mapeada, ainda não implementada.

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

## Dívida técnica em aberto

Levantada durante a organização da documentação, ainda não resolvida:

- **Sem testes.** `backend/tests/` existe mas está vazio. Não há suíte nem runner configurado.
- **Sem migrations.** O schema é recriado via `CREATE TABLE IF NOT EXISTS` no boot. Funciona
  para o MVP, mas qualquer alteração de coluna em produção vira trabalho manual.
- **Uploads efêmeros** em produção (item 8).
- **`backend/.gitignore`** tem o padrão `backend/uploads/`. Como o arquivo já está dentro de
  `backend/`, esse padrão aponta para `backend/backend/uploads/` e não ignora nada.
  Deveria ser só `uploads/`.
- **`frontend/.env`** está versionado no git. Hoje só contém `VITE_API_URL`, mas o padrão
  convida a vazar segredo depois.
- **`backend/cod.js`** é um arquivo vazio (0 bytes) e órfão.
