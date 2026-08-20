# Deploy — Mais Horas

O [`render.yaml`](../render.yaml) na raiz é um blueprint que provisiona os três serviços de
uma vez: banco Postgres, API Node e site estático.

## Serviços provisionados

| Serviço | Tipo | Diretório | Comando |
|---|---|---|---|
| `mais-horas-db` | PostgreSQL (free) | — | — |
| `mais-horas-api` | Web / Node (free) | `backend` | `npm install` → `npm start` |
| `mais-horas-web` | Static site (free) | `frontend` | `npm install && npm run build` → `./dist` |

O site estático usa rewrite de `/*` para `/index.html`, necessário para o roteamento
client-side do React Router funcionar em links diretos (ex.: alguém abrindo
`/verificar/ABC123` direto do QR Code).

## Passo a passo

1. Suba o repositório no GitHub.
2. No Render: **New** → **Blueprint** → selecione o `render.yaml`.
3. Aguarde o primeiro deploy. Ele vai falhar parcialmente até as envs serem preenchidas —
   é esperado.
4. Preencha as variáveis marcadas `sync: false`:

   Em **`mais-horas-api`**:
   - `APP_URL` — a URL pública da própria API (ex.: `https://mais-horas-api.onrender.com`)
   - `WEB_URL` — a URL do site (usada para montar o link dentro do QR Code do certificado)
   - `CORS_ORIGIN` — a URL do site (aceita várias, separadas por vírgula)

   Em **`mais-horas-web`**:
   - `VITE_API_URL` — a URL da API, **sem barra no final**

5. Faça redeploy do frontend. O Vite injeta `VITE_API_URL` no momento do build, então
   mudar a env sem rebuildar não tem efeito.

## Variáveis de ambiente

### Backend

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do Postgres. No Render vem automática do `mais-horas-db` |
| `JWT_SECRET` | sim | Secret de assinatura do JWT. **O servidor aborta o boot se faltar.** No Render é gerada automaticamente |
| `APP_URL` | sim | URL pública da API |
| `WEB_URL` | sim | URL pública do site — vira o destino do QR Code |
| `CORS_ORIGIN` | recomendada | Origens permitidas, separadas por vírgula. **Vazio libera todas** — nunca deixe vazio em produção |
| `PGSSL` | em produção | `true` para exigir SSL na conexão. `NODE_ENV=production` tem o mesmo efeito |
| `PORT` | não | Padrão `3000` |

### Frontend

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | sim | URL base da API, sem barra no final |

Modelos completos em [`backend/.env.example`](../backend/.env.example) e
[`frontend/.env.example`](../frontend/.env.example).

## O banco

Não há sistema de migrations. No primeiro boot, `connectDB()` roda o `SCHEMA_SQL` de
`backend/src/config/database.js`, que usa `CREATE TABLE IF NOT EXISTS` — as tabelas nascem
sozinhas e o boot é idempotente.

**Consequência:** alterar uma coluna existente não acontece automaticamente. Em produção,
qualquer mudança de schema precisa ser aplicada manualmente via `psql` antes do deploy.

## Limitação conhecida: uploads

O disco do plano free do Render é **efêmero**. As fotos de perfil são gravadas em
`backend/uploads/` e **somem a cada redeploy**.

Em desenvolvimento isso não incomoda. Para produção de verdade, a correção é trocar o
`multer` de disco por um storage externo (Cloudinary, S3 ou R2) em
`backend/src/config/upload.js`. Está registrado como dívida técnica em
[backend-refactor.md](backend-refactor.md).

## Nota sobre o plano free

Serviços free do Render hibernam após inatividade. A primeira requisição depois de um
período parado pode levar ~30 segundos para responder enquanto o serviço acorda.
Vale saber disso antes de uma demonstração ao vivo — abra a aplicação alguns minutos antes.
