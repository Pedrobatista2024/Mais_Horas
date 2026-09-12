# Arquitetura — Mais Horas

Como o código está organizado, quais são as rotas de tela e como é o banco.

## Visão geral

```
Frontend (React + Vite + Mantine)          Backend (Python + FastAPI)
        :5173                                       :3000
          |                                           |
          |  axios  ->  /api/*                        |
          |    access token no header Authorization   |
          |    refresh token em cookie httpOnly       |
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
  app/
    main.py            boot: checagem de env, headers, CORS, rotas, handlers de erro
    core/
      config.py        Settings (pydantic-settings), lê o .env
      security.py      hash de senha (Argon2id + bcrypt legado), JWT, refresh token
      deps.py          get_db, get_current_user, require_role
      errors.py        AppError + handlers centrais
      rate_limit.py    limite de tentativas em login/registro
    db/
      session.py       engine e sessão async (SQLAlchemy 2.0 + asyncpg)
      models.py        User, Activity, Participation, Certificate, RefreshToken
      migration_utils.py  helper das migrations
    schemas/           Pydantic — validação de entrada (equivale aos validators zod)
    services/          regra de negócio (user, activity, participation, certificate)
    routers/           endpoints + dependências de auth/papel
    utils/             datas, código de verificação, PDF+QR, serialização
  alembic/             migrations (0001 schema inicial, 0002 refresh_tokens)
  smoke_test.py        teste de fumaça ponta a ponta (68 verificações)
  requirements.txt
```

**Fluxo de uma requisição:**

```
rota -> Depends(get_current_user) -> Depends(require_role) -> Pydantic -> service -> SQLAlchemy
                                                                       |
                                                 erro em qualquer ponto -> exception handler
```

Diferente do Express, a validação e a autorização não são middlewares escondidos: elas
aparecem na **assinatura do endpoint**, então o FastAPI já documenta quem exige token e
qual papel cada rota pede. A documentação OpenAPI sai de graça em `/docs`.

Os handlers em `core/errors.py` traduzem `RequestValidationError` em `400` com lista de
campos, `AppError` no status do próprio erro, violação de unique do Postgres (`23505`) em
`409`. Qualquer outra coisa vira `500` genérico com log no servidor.

## Frontend

```
frontend/src/
  main.jsx             MantineProvider + Notifications + AuthProvider
  App.jsx              rotas (react-router), lazy loading por página
  theme.js             paleta Mantine (brand, navy, clay, ink)
  index.css            classes utilitárias .mh-*
  config/api.js        base URL da API (VITE_API_URL)
  services/api.js      axios + access token em memória + renovação compartilhada
                       no 401; mensagemDoErro / codigoDoErro
  context/AuthContext  sessão do usuário (entrar, sair, autenticado, carregando)
  routes/
    RotaPrivada.jsx    guarda por autenticação e papel
    destinos.js        para onde cada papel vai depois de entrar
  hooks/useFetch       GET com { data, loading, error, refetch, setData }
  components/
    layout/            PainelLayout (área logada), AuthLayout, PublicPage
    atividade/         CartaoAtividade, SituacaoBadge, situacoes.js,
                       BotaoInscricao
    perfil/            FotoPerfil
    ui/                PageHeader, EmptyState, Loading, ConfirmarAcao, StatCard,
                       ActionCard, InfoItem, StatusBadge, BackButton, BrandMark,
                       BrandIcon, ClockGlyph, WelcomeBanner
  pages/
    auth/              Entrar, CriarConta, EsqueciSenha, RedefinirSenha
    perfil/            MeuPerfil (serve aos dois papéis)
    estudante/         Vitrine, DetalheAtividade, MinhasInscricoes
    ong/               MinhasAtividades, FormularioAtividade, GerenciarAtividade,
                       InscricoesDaAtividade
    public/            Landing (+ telas antigas ainda não migradas)
    EmConstrucao.jsx   ocupa as rotas de painel até as fatias correspondentes
  utils/
    format.js          formatDate, formatDateLong, resolveImage, initials
    notify.js          notifySuccess / notifyError (toasts Mantine)
```

`pages/student/`, `pages/org/` e parte de `pages/public/` ainda guardam telas da versão
Node/Express. Não estão roteadas e falam com uma API que não existe mais — cada fatia
apaga as que substitui.

As convenções de UI (paleta, componentes reutilizáveis, responsividade) estão em
[`.claude/skills/frontend-maishoras/SKILL.md`](../.claude/skills/frontend-maishoras/SKILL.md).

## Rotas de tela

As telas entram fatia a fatia. Rota de fatia não entregue **não é registrada**: chamaria
endpoint inexistente, e tela quebrada é pior que tela ausente.

| Rota | Acesso | Tela |
|---|---|---|
| `/` | público | Landing (redireciona quem já entrou ao painel do papel) |
| `/entrar` | público | Entrar |
| `/criar-conta` | público | Criar conta |
| `/esqueci-senha` | público | Pedir redefinição |
| `/redefinir-senha` | público | Definir nova senha |
| `/perfil` | autenticado | `E7`/`O8` Meu perfil |
| `/painel` | aluno | `E1` Painel *(em construção)* |
| `/atividades` | aluno | `E2` Vitrine |
| `/atividades/:id` | aluno | `E3` Detalhe da atividade |
| `/minhas-inscricoes` | aluno | `E4` Minhas inscrições |
| `/ong` | ONG | `O1` Painel *(em construção)* |
| `/ong/atividades` | ONG | `O2` Minhas atividades |
| `/ong/atividades/nova` | ONG | `O3` Criar atividade |
| `/ong/atividades/:id` | ONG | `O4` Gerenciar atividade |
| `/ong/atividades/:id/editar` | ONG | `O3` Editar atividade |
| `/ong/atividades/:id/inscricoes` | ONG | `O5` Inscrições da atividade |
| `/admin` | superadmin | `A1` Visão geral *(em construção)* |

Papel errado não dá erro: o usuário é levado ao painel dele. Ele não fez nada de errado,
só digitou o endereço de outro. Rota inexistente cai em `/`. Os endereços da versão
anterior (`/login`, `/dashboard`, `/activities`...) redirecionam para os novos.

## Banco de dados

O schema é versionado com **Alembic** (`backend/alembic/versions/`). Aplique com:

```bash
cd backend && alembic upgrade head
```

As migrations usam `CREATE TABLE IF NOT EXISTS`, então rodam tanto em banco novo quanto
num banco que já foi criado pelo backend Node — sem precisar de `alembic stamp` manual.

```
users
  id UUID PK              email TEXT UNIQUE
  name TEXT               password TEXT (Argon2id; bcrypt legado aceito no login)
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

refresh_tokens
  id UUID PK
  user_id UUID            -> users(id) ON DELETE CASCADE
  token_hash VARCHAR(64)  UNIQUE — SHA-256; o token em claro nunca é gravado
  family_id UUID          agrupa os tokens rotacionados a partir de um login
  expires_at TIMESTAMPTZ
  used_at TIMESTAMPTZ     quando foi consumido pela rotação
  revoked_at TIMESTAMPTZ  logout ou revogação da família por suspeita de roubo
  user_agent, ip_address  contexto da sessão
```

Todas as tabelas têm `created_at` e `updated_at` (`TIMESTAMPTZ`, default `NOW()`).

**Índices:** `activities(created_by)`, `participations(activity_id)`,
`participations(user_id)`, `certificates(user_id)`, `refresh_tokens(user_id)`,
`refresh_tokens(family_id)`, `refresh_tokens(expires_at)`.

**Decisões importantes:**

- `participations` é a **fonte única de verdade** da inscrição. O `UNIQUE(activity_id, user_id)`
  impede inscrição duplicada e a contagem de vagas sai de `COUNT(*)` — não há array de
  participantes duplicado dentro de `activities`.
- `participation_id UNIQUE` em `certificates` garante **um certificado por participação**.
- Perfis usam **JSONB** porque aluno e ONG têm campos muito diferentes; evita uma tabela
  larga com metade das colunas sempre nulas.
- A API expõe o `id` também como `"_id"` (alias) — herança da versão MongoDB, mantida
  para não quebrar o frontend. A tradução acontece só em `app/utils/serialize.py`.
- `refresh_tokens` guarda **hash**, nunca o token. Vazamento do banco não dá sessão a
  ninguém. Ver [autenticacao.md](autenticacao.md).
