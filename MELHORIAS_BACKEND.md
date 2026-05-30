# Mapa de melhorias do Backend — Mais Horas

Levantamento dos pontos fracos encontrados no backend e o que foi (ou será) feito.
Status: ✅ feito agora · 🔶 recomendado depois

---

## 1. Validação de entrada
**Problema:** cada controller validava na mão (`if (!title) ...`), com regras espalhadas, duplicadas entre `create` e `update`, e sem padrão de resposta de erro.
**Solução ✅:** schemas com **zod** (`src/validators/*`) + middleware `validate` que roda antes do controller. Entrada inválida retorna `400` com lista de campos e mensagens padronizadas.

## 2. Tratamento de erros
**Problema:** `try/catch` repetido em todo controller, com `console.error` + `res.status(500)` copiado dezenas de vezes. Mensagens inconsistentes (`error` vs `message`).
**Solução ✅:** wrapper `asyncHandler` remove o try/catch repetido; **middleware de erro central** (`error.middleware.js`) formata toda resposta de erro no mesmo formato `{ message, details? }`. Classe `AppError` para erros de negócio com status correto.

## 3. Autorização por papel (role)
**Problema:** qualquer usuário logado conseguia chamar rotas de ONG (criar/finalizar atividade). A checagem era feita ad-hoc dentro de alguns controllers (`activity.createdBy === req.user._id`), e faltava em outros.
**Solução ✅:** middleware `requireRole("organization")` / `requireRole("student")` nas rotas. A checagem de dono (ownership) virou helper reutilizável no service.

## 4. Camada de serviço (regras de negócio)
**Problema:** controllers gordos misturando HTTP + regra de negócio + acesso a dados (ex.: `finishActivity` com 80 linhas).
**Solução ✅:** `src/services/*` concentram a regra (finalizar atividade, gerar certificados, validar presença). Controllers ficam finos: validam, chamam o service, devolvem resposta.

## 5. Segurança
**Problema:** sem headers de segurança; `cors()` liberado para qualquer origem; login sem proteção contra força bruta; JWT sem checagem de secret ausente.
**Solução ✅:**
- **helmet** (headers de segurança)
- **express-rate-limit** no `/users/login` e `/users/register` (anti força-bruta)
- CORS configurável por env (`CORS_ORIGIN`), com fallback liberado em dev
- valida presença de `JWT_SECRET` no boot

## 6. Consistência de dados / integridade
**Problema:** no Mongo o array `participants` dentro de `Activity` duplicava a info que já estava em `Participation`, podendo divergir.
**Solução ✅ (já na migração p/ Postgres):** fonte única de verdade = tabela `participations` com `UNIQUE(activity_id, user_id)` e contagem por `COUNT(*)`. FKs com `ON DELETE CASCADE`.

## 7. Geração de certificado / QR (o "desafio técnico")
**Problema:** o código de verificação era só um hash aleatório (`crypto.randomBytes`). Validação por QR existia, mas a página pública era HTML cru montado por string (risco de injeção e visual pobre).
**Solução ✅:**
- página de verificação virou rota do **frontend** (`/verificar/:code`), bonita e responsiva, consumindo o endpoint JSON `GET /certificates/validate/:code`.
- QR do PDF aponta para essa página pública.
**Recomendado 🔶 (próximo nível, ótimo p/ o trabalho de faculdade):** check-in de presença com **QR dinâmico/rotativo** (token com expiração curta por atividade), impedindo "passar foto do QR" para terceiros. Ver seção "Desafio tecnológico" abaixo.

## 8. Uploads
**Problema:** fotos salvas em disco local (`uploads/`) — some a cada deploy no Render (disco efêmero). Sem limpeza de órfãos.
**Solução ✅ (parcial):** mantido em disco para dev, documentada a limitação.
**Recomendado 🔶:** storage externo (Cloudinary/S3/R2) em produção.

## 9. Variáveis de ambiente
**Problema:** `APP_URL`, `JWT_SECRET` usados sem checagem; `.env` versável.
**Solução ✅:** `.env.example` documentado, `.gitignore` cobrindo `.env`, checagem de secret no boot.

## 10. Padrões gerais
**Solução ✅:** estrutura de pastas clara (`validators/`, `services/`, `middlewares/`, `utils/`), respostas de API uniformes, remoção de `console.log` de debug.

---

## Desafio tecnológico (para o trabalho da faculdade)

A barreira central do projeto é **garantir que a hora complementar é verdadeira** — ou seja, que o aluno realmente esteve presente e que o certificado não é forjado. Três camadas tratam isso:

1. **Autenticidade do certificado (implementado):** cada certificado tem um `verification_code` único e uma página pública de verificação acessível por **QR Code**. Qualquer pessoa (coordenação do curso, faculdade) escaneia e confirma na hora se o certificado é válido, de quem é, de qual atividade e quantas horas — sem depender de PDF que pode ser editado.

2. **Verificação de presença (implementado, nível básico):** a presença é validada pela ONG responsável (papel `organization`), e só presenças confirmadas geram certificado. Há trava: a atividade não finaliza enquanto houver presença pendente.

3. **Anti-fraude de presença com QR dinâmico (recomendado, evolução):** gerar na hora do evento um QR que **expira em segundos e rotaciona**, exibido pela ONG; o aluno escaneia para registrar check-in. Como o token muda o tempo todo, não adianta tirar print e mandar pra um colega que não foi. Tecnologia: token assinado (JWT de curta duração) + janela de tempo (TOTP-like) + geolocalização opcional. **Esse é o ponto mais forte para apresentar como desafio + solução tecnológica.**

Escalabilidade / descoberta de ONGs (atrair muitas ONGs e divulgar) é um desafio **de produto/negócio**, não tão "tecnológico" — vale citar, mas o QR dinâmico é o melhor case de engenharia.
