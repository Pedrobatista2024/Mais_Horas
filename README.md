# Mais Horas

Plataforma que conecta **estudantes** e **ONGs**: as ONGs publicam vagas de
voluntariado (como ofertas de trabalho), os estudantes se inscrevem para cumprir
horas de extensão, e a presença confirmada gera um **certificado validável por QR Code**.

## Stack

- **Backend**: Node + Express + `pg` (PostgreSQL nativo), validação com **zod**, segurança com **helmet** + **rate limit**
- **Frontend**: React + Vite + **Mantine** (UI), organizado por telas
- **Banco**: PostgreSQL (UUID, JSONB para perfis)

## Arquitetura

```
backend/src
  config/        conexão + schema do Postgres, upload (multer)
  validators/    schemas zod (entrada validada antes do controller)
  middlewares/   auth, requireRole, validate, asyncHandler, erro central, rate limit
  services/      regras de negócio (user, activity, participation, certificate)
  controllers/   finos: chamam o service e respondem
  routes/        rotas + middlewares aplicados
  models/        acesso a dados (SQL)
  utils/         AppError, token, código de verificação, PDF, datas

frontend/src
  context/       AuthContext (sessão)
  components/    layout (AppShell/Navbar), ui (cards, badges...), forms
  hooks/         useFetch
  pages/auth     login, register
  pages/student  dashboard, atividades, inscrições, certificados, perfil
  pages/org      dashboard, atividades, criar/editar, participantes, perfil
  pages/public   verificação de certificado, perfis públicos
  utils/         formatação, notificações (toast)
```

## Rodar local

### 1. Postgres (Docker)

```bash
docker compose up -d   # sobe Postgres na porta 5433 do host
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev            # cria as tabelas automaticamente no 1º boot
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Deploy no Render

`render.yaml` na raiz provisiona Postgres + API + site estático. Passos:

1. Suba o repo no GitHub.
2. Render → **New** → **Blueprint** → selecione o `render.yaml`.
3. Após o 1º deploy, preencha as envs marcadas `sync: false`:
   - `mais-horas-api`: `APP_URL` e `WEB_URL`/`CORS_ORIGIN` (URL do site)
   - `mais-horas-web`: `VITE_API_URL` (URL da API)
4. Redeploy do frontend.

> **Uploads**: o disco do plano free do Render é efêmero (fotos somem em redeploy).
> Para produção, use storage externo (Cloudinary/S3). Em dev funciona em `backend/uploads/`.

## Verificação de certificado (desafio técnico)

Cada certificado tem um código único e uma página pública `/verificar/:code` acessível
por QR Code, que confirma estudante, atividade, ONG e horas — sem depender do PDF, que
poderia ser editado. Veja `MELHORIAS_BACKEND.md` para a evolução proposta (QR dinâmico
anti-fraude de presença).

## Estrutura do banco

```
users          (id UUID, name, email UNIQUE, password, role,
                student_profile JSONB, organization_profile JSONB)
activities     (id UUID, title, description, date, start/end_time, location,
                workload_hours, created_by → users, min/max_participants, status)
participations (id UUID, activity_id → activities, user_id → users,
                status: pending|present|absent, validated_by, workload_hours,
                UNIQUE(activity_id, user_id))
certificates   (id UUID, user_id, activity_id, participation_id UNIQUE,
                hours, verification_code UNIQUE, issued_at)
```

A API expõe o ID como `"_id"` (alias) para compatibilidade com o frontend.
