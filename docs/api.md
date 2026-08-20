# Referência da API — Mais Horas

Base: `http://localhost:3000` em dev (`APP_URL` em produção).
Todas as rotas de negócio ficam sob `/api`.

## Autenticação

JWT no header, obtido em `POST /api/users/login`:

```
Authorization: Bearer <token>
```

A coluna **Acesso** abaixo significa:

- `público` — sem token
- `logado` — qualquer usuário autenticado
- `aluno` — exige `role: "student"` (via `requireRole`)
- `ONG` — exige `role: "organization"`

## Formato de erro

Toda resposta de erro sai no mesmo formato, do middleware central:

```json
{ "message": "Dados inválidos", "details": [{ "field": "email", "message": "Email inválido" }] }
```

O campo `details` só aparece em erros de validação (zod) e em `AppError` que o traga.

| Status | Quando |
|---|---|
| `400` | validação zod falhou, ou erro de upload (multer) |
| `401` | token ausente ou inválido |
| `403` | role errado para a rota, ou não é dono do recurso |
| `404` | recurso ou rota inexistente |
| `409` | violação de unique no Postgres (ex.: email já cadastrado) |
| `429` | rate limit em `/register` e `/login` |
| `500` | erro não tratado (mensagem genérica, detalhe fica no log) |

## Rotas de serviço

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/` | público | Texto de status da API |
| `GET` | `/health` | público | `{ "status": "ok" }` |
| `GET` | `/uploads/:arquivo` | público | Serve as imagens de perfil enviadas |

## Usuários — `/api/users`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/register` | público | Cria conta. **Rate limit** |
| `POST` | `/login` | público | Retorna JWT. **Rate limit** |
| `GET` | `/profile` | logado | Perfil do próprio usuário |
| `PUT` | `/profile` | logado | Atualiza perfil. Aceita `multipart/form-data` com `photo` |
| `GET` | `/org/:orgId/public` | logado | Perfil público de uma ONG |
| `GET` | `/student/:studentId/public` | logado | Perfil público de um aluno |

**`POST /register`**

```json
{
  "name": "Maria Silva",        // 2 a 120 caracteres
  "email": "maria@email.com",   // email válido, salvo em minúsculas
  "password": "senha123",       // mínimo 6 caracteres
  "role": "student"             // opcional: "student" (padrão) | "organization"
}
```

**`POST /login`**

```json
{ "email": "maria@email.com", "password": "senha123" }
```

**`PUT /profile`** — aceita qualquer subconjunto dos campos. Campos de aluno:
`fullName`, `sex`, `birthDate`, `phone`, `city`, `state`, `neighborhood`,
`institution`, `courseName`, `aboutMe`, `linkedin`, `photoUrl`.
Campos de ONG: `organizationName`, `cnpj`, `description`, `website`, `instagram`, `address`.
A foto vai no campo `photo` (só imagens, máx **2MB**).

## Atividades — `/api/activities`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/` | público | Lista todas as atividades |
| `POST` | `/` | ONG | Cria atividade |
| `GET` | `/my` | ONG | Atividades criadas pela ONG logada |
| `GET` | `/:id` | logado | Detalhes de uma atividade |
| `POST` | `/:id/join` | aluno | Aluno se inscreve |
| `PUT` | `/:id` | ONG | Edita a própria atividade |
| `PATCH` | `/:id/attendance` | ONG | Marca presença/falta de um aluno |
| `POST` | `/:id/finish` | ONG | Finaliza a atividade e gera certificados |
| `DELETE` | `/:id` | ONG | Remove a própria atividade |

**`POST /`** (criar)

```json
{
  "title": "Mutirão de limpeza",   // obrigatório, máx 40 caracteres
  "description": "...",            // obrigatório, máx 1500
  "location": "Praça Central",     // obrigatório, máx 50
  "date": "2026-09-15",            // AAAA-MM-DD
  "startTime": "08:00",            // HH:MM, precisa ser menor que endTime
  "endTime": "12:00",              // HH:MM
  "workloadHours": 4,              // inteiro > 0
  "minParticipants": 1,            // padrão 1
  "maxParticipants": 20            // padrão 20, precisa ser >= minParticipants
}
```

**`PUT /:id`** — mesmos campos, todos opcionais.

**`PATCH /:id/attendance`**

```json
{ "userId": "<uuid do aluno>", "status": "present" }   // "present" | "absent"
```

**`POST /:id/finish`** — a atividade **não finaliza** enquanto houver presença com
status `pending`. Ao finalizar, gera certificado para cada presença `present`.

## Participações — `/api/participations`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/` | aluno | Inscreve o aluno em uma atividade |
| `GET` | `/my` | logado | Participações do usuário logado |
| `GET` | `/activity/:activityId` | logado | Participações de uma atividade |
| `PUT` | `/:participationId/validate` | ONG | Valida a presença |

**`POST /`**

```json
{ "activityId": "<uuid>" }
```

**`PUT /:participationId/validate`**

```json
{ "status": "present" }   // "pending" | "present" | "absent"
```

## Certificados — `/api/certificates`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/:participationId` | ONG | Emite certificado para a participação |
| `GET` | `/my` | logado | Certificados do usuário logado |
| `GET` | `/:id/pdf` | logado | Baixa o PDF do certificado |
| `GET` | `/validate/:code` | **público** | Valida um certificado pelo código do QR |
| `GET` | `/public/:code/pdf` | **público** | Baixa o PDF pelo código do QR |

`GET /validate/:code` é o endpoint que a página `/verificar/:code` do frontend consome —
o QR Code impresso no PDF aponta para essa página. Ver
[desafio-tecnico.md](desafio-tecnico.md) para o raciocínio por trás disso.

## Dashboard — `/api/dashboard`

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| `GET` | `/student` | aluno | Números do painel do aluno (horas, inscrições, certificados) |

## Rate limiting

`POST /api/users/register` e `POST /api/users/login` aceitam **20 requisições por IP a
cada 15 minutos**. Estourou, volta `429`:

```json
{ "message": "Muitas tentativas. Tente novamente em alguns minutos." }
```
