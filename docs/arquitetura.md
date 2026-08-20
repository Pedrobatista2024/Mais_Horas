# Arquitetura — Mais Horas

Como o código está organizado, quais são as rotas de tela e como é o banco.

## Visão geral

```
Frontend (React + Vite + Mantine)          Backend (Node + Express)
        :5173                                       :3000
          |                                           |
          |  axios  ->  /api/*  (JWT no header)  ->   |
          |                                           |
                                              PostgreSQL :5433
```

Três camadas de acesso:

- **Público** — landing, login/registro e verificação de certificado (`/verificar/:code`)
- **Aluno** (`role: student`) — busca atividades, se inscreve, acompanha horas e certificados
- **ONG** (`role: organization`) — publica atividades, valida presença, emite certificados

## Backend

```
backend/
  server.js              boot: env check, helmet, cors, rotas, error handler
  src/
    config/
      database.js        pool do pg + SCHEMA_SQL (cria tabelas no 1o boot)
      upload.js          multer em disco, só imagens, máx 2MB
    validators/          schemas zod (activity, participation, user, common)
    middlewares/
      auth.middleware.js       verifica JWT, popula req.user
      role.middleware.js       requireRole("student" | "organization")
      validate.middleware.js   valida body/params/query antes do controller
      asyncHandler.js          remove try/catch repetido
      error.middleware.js      notFound + errorHandler central
      rateLimit.middleware.js  authLimiter (20 req / 15 min por IP)
    services/            regra de negócio (activity, participation, certificate, user)
    controllers/         finos: validam entrada, chamam service, respondem
    routes/              monta rotas + middlewares
    models/              acesso a dados (SQL puro)
    utils/               AppError, token, código de verificação, PDF, datas
  tests/                 (vazio — sem suíte de testes ainda)
```

**Fluxo de uma requisição:**

```
rota -> authMiddleware -> requireRole -> validate(zod) -> controller -> service -> model -> pg
                                                                    |
                                              erro em qualquer ponto -> errorHandler
```

O `errorHandler` traduz `ZodError` em `400`, `AppError` no status do próprio erro,
violação de unique do Postgres (`23505`) em `409` e `MulterError` em `400`.
Qualquer outra coisa vira `500` genérico com log no servidor.

## Frontend

```
frontend/src/
  main.jsx             MantineProvider + Notifications + AuthProvider
  App.jsx              rotas (react-router), lazy loading por página
  theme.js             paleta Mantine (brand, navy, clay, ink)
  index.css            classes utilitárias .mh-*
  config/api.js        base URL da API (VITE_API_URL)
  services/api.js      instância axios + interceptor de token
  context/AuthContext  sessão do usuário (login, logout, isAuthenticated)
  routes/PrivateRoute  guarda de rota por autenticação e role
  hooks/useFetch       GET com { data, loading, error, refetch, setData }
  components/
    layout/            AppLayout (AppShell logado), AuthLayout, PublicPage
    ui/                PageHeader, StatCard, ActivityCard, ActionCard, InfoItem,
                       StatusBadge, EmptyState, Loading, BackButton, BrandMark,
                       BrandIcon, ClockGlyph, WelcomeBanner
    forms/             ActivityForm (compartilhado entre criar e editar)
  pages/
    public/            Landing, VerifyCertificate, OrgPublicProfile, StudentPublicProfile
    auth/              Login, Register
    student/           Dashboard, Activities, ActivityDetails, MyActivities,
                       MyCertificates, EditProfile
    org/               Dashboard, MyActivities, CreateActivity, EditActivity,
                       ActivityDetails, Participants, Profile, EditProfile
  utils/
    format.js          formatDate, resolveImage, initials
    notify.js          notifySuccess / notifyError (toasts Mantine)
```

As convenções de UI (paleta, componentes reutilizáveis, responsividade) estão em
[`.claude/skills/frontend-maishoras/SKILL.md`](../.claude/skills/frontend-maishoras/SKILL.md).

## Rotas de tela

| Rota | Acesso | Página |
|---|---|---|
| `/` | público | Landing (redireciona logado p/ `/dashboard` ou `/org`) |
| `/login` | público | Login |
| `/register` | público | Register |
| `/verificar/:code` | público | Verificação de certificado por QR Code |
| `/org/:id/public` | público | Perfil público da ONG |
| `/student/:id/public` | público | Perfil público do aluno |
| `/dashboard` | aluno | Painel do aluno |
| `/activities` | aluno | Buscar atividades |
| `/student/activity/:id` | aluno | Detalhes da atividade |
| `/my-activities` | aluno | Minhas inscrições |
| `/my-certificates` | aluno | Meus certificados |
| `/edit-student-profile` | aluno | Editar perfil |
| `/org` | ONG | Painel da ONG |
| `/org/my-activities` | ONG | Atividades publicadas |
| `/org/create-activity` | ONG | Criar atividade |
| `/org/activity/:id` | ONG | Detalhes da atividade |
| `/org/activity/:id/edit` | ONG | Editar atividade |
| `/org/activity/:id/participants` | ONG | Participantes e validação de presença |
| `/org/profile` | ONG | Perfil |
| `/org/profile/edit` | ONG | Editar perfil |

Qualquer rota não encontrada cai em `/login`.

## Banco de dados

O schema é criado automaticamente no primeiro boot (`SCHEMA_SQL` em
`src/config/database.js`) — não há sistema de migrations.

```
users
  id UUID PK              email TEXT UNIQUE
  name TEXT               password TEXT (bcrypt)
  role TEXT               CHECK ('student' | 'organization'), default 'student'
  student_profile JSONB   dados do aluno (curso, instituição, cidade, sobre...)
  organization_profile JSONB   dados da ONG (CNPJ, site, endereço...)

activities
  id UUID PK              title, description, location TEXT
  date TIMESTAMPTZ        start_time, end_time TEXT ("HH:MM")
  workload_hours INTEGER
  created_by UUID         -> users(id) ON DELETE CASCADE
  min_participants INT    default 1
  max_participants INT    default 20
  status TEXT             CHECK ('active' | 'finished' | 'cancelled'), default 'active'

participations
  id UUID PK
  activity_id UUID        -> activities(id) ON DELETE CASCADE
  user_id UUID            -> users(id) ON DELETE CASCADE
  status TEXT             CHECK ('pending' | 'present' | 'absent'), default 'pending'
  validated_by UUID       -> users(id) ON DELETE SET NULL
  workload_hours INTEGER  default 0
  UNIQUE (activity_id, user_id)

certificates
  id UUID PK
  user_id UUID            -> users(id) ON DELETE CASCADE
  activity_id UUID        -> activities(id) ON DELETE CASCADE
  participation_id UUID   -> participations(id) ON DELETE CASCADE, UNIQUE
  hours INTEGER
  verification_code TEXT  UNIQUE — é o que o QR Code carrega
  issued_at TIMESTAMPTZ
```

Todas as tabelas têm `created_at` e `updated_at` (`TIMESTAMPTZ`, default `NOW()`).

**Índices:** `activities(created_by)`, `participations(activity_id)`,
`participations(user_id)`, `certificates(user_id)`.

**Decisões importantes:**

- `participations` é a **fonte única de verdade** da inscrição. O `UNIQUE(activity_id, user_id)`
  impede inscrição duplicada e a contagem de vagas sai de `COUNT(*)` — não há array de
  participantes duplicado dentro de `activities`.
- `participation_id UNIQUE` em `certificates` garante **um certificado por participação**.
- Perfis usam **JSONB** porque aluno e ONG têm campos muito diferentes; evita uma tabela
  larga com metade das colunas sempre nulas.
- A API expõe o `id` também como `"_id"` (alias) — herança da versão MongoDB, mantida
  para não quebrar o frontend.
