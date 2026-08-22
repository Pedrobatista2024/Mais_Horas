# Contrato da API — Mais Horas

Todos os endpoints, quem pode chamar cada um e o que trafega. Traduz a
[especificação](especificacao.md) e os [fluxos](fluxos.md) para HTTP, sobre o
[modelo de dados](modelo-dados.md).

---

## 1. Decisões

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| **D34** | Idioma das rotas | **Português**, igual ao banco | Uma palavra só do banco até a tela, sem tradução no meio |
| **D35** | Versionamento | **`/api/v1/`** desde já | Custa nada agora e evita quebrar cliente depois |
| **D36** | Rotas do admin | **Próprias, em `/admin`** | Operação administrativa fica óbvia e a auditoria distingue sem esforço |
| **D37** | Paginação | **Em todas as listagens** | Formato único no frontend; nunca há resposta gigante inesperada |

**Base:** `https://<host>/api/v1`

---

## 2. Convenções

### 2.1 Autenticação

```
Authorization: Bearer <access token>
```

Access token dura 15 minutos. O refresh vive no cookie `httpOnly` `mh_refresh`, com escopo
`/api/v1/auth`. O cliente precisa enviar credenciais (`withCredentials: true`).

**Coluna Acesso, nas tabelas abaixo:**

| Marca | Significa |
|---|---|
| 🌐 | Público, sem token |
| 🔒 | Qualquer autenticado |
| 🎓 | Só `estudante` |
| 🏢 | Só `ong` |
| 👑 | Só `superadmin` |

### 2.2 Paginação (D37)

Toda listagem aceita `pagina` (padrão 1) e `tamanho` (padrão 20, máximo 100), e responde:

```json
{
  "itens": [ ... ],
  "pagina": 1,
  "tamanho": 20,
  "total": 137,
  "paginas": 7
}
```

### 2.3 Erro

Formato único, sempre:

```json
{
  "codigo": "vagas_esgotadas",
  "mensagem": "As vagas desta atividade se esgotaram",
  "detalhes": [ { "campo": "email", "mensagem": "E-mail inválido" } ]
}
```

`codigo` é estável e legível por máquina — o frontend decide o que fazer por ele, nunca
comparando texto de mensagem. `detalhes` só aparece em erro de validação.

| Status | Quando |
|---|---|
| `400` | Validação ou regra de negócio recusou |
| `401` | Token ausente, inválido ou expirado |
| `403` | Papel errado, não é dono, ou modo somente leitura |
| `404` | Recurso inexistente |
| `409` | Conflito (e-mail duplicado, inscrição duplicada) |
| `422` | Requisição bem formada mas semanticamente inválida |
| `429` | Limite de requisições |
| `500` | Erro não tratado |

### 2.4 Datas

Entrada e saída em ISO 8601 com fuso. O servidor interpreta em `America/Sao_Paulo` (RN-53).

```json
{ "data": "2026-06-15", "horaInicio": "08:00", "horaFim": "12:00" }
```

### 2.5 Nomes de campo

Banco em `snake_case`, **JSON em `camelCase`**. A tradução mora em um único lugar
(`app/utils/serialize.py`). Não existe mais `_id` (D29) — o campo é `id`.

---

## 3. Serviço

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/saude` | 🌐 | `{ "status": "ok" }` |
| `GET` | `/uploads/{arquivo}` | 🌐 | Serve imagens de perfil |

---

## 4. Autenticação — `/auth`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `POST` | `/auth/cadastro` | 🌐 | Cria conta e inicia sessão. **Rate limit** |
| `POST` | `/auth/entrar` | 🌐 | Autentica. **Rate limit** |
| `POST` | `/auth/renovar` | 🍪 | Rotaciona a sessão pelo cookie |
| `POST` | `/auth/sair` | 🍪 | Revoga a família e limpa o cookie |
| `POST` | `/auth/senha/esqueci` | 🌐 | Dispara o e-mail de redefinição. **Rate limit** |
| `POST` | `/auth/senha/redefinir` | 🌐 | Troca a senha usando o token do link |

**`POST /auth/cadastro`**

```json
{ "nome": "Maria Silva", "email": "maria@email.com",
  "senha": "algo-bem-longo", "papel": "estudante" }
```

`papel` aceita só `estudante` ou `ong` — nunca `superadmin` (RN-27).

**Resposta de sessão** — usada por cadastro, entrar e renovar:

```json
{
  "usuario": { "id": "...", "nome": "Maria Silva",
               "email": "maria@email.com", "papel": "estudante" },
  "token": "<access token>",
  "expiraEm": 900
}
```

O refresh **não aparece no corpo** — vai no cookie.

**`POST /auth/senha/esqueci`** — responde `200` sempre, exista o e-mail ou não (FA-04 E1).

| Código de erro | Situação |
|---|---|
| `email_em_uso` | `409` no cadastro |
| `credenciais_invalidas` | `400` no login, para e-mail inexistente **e** senha errada |
| `conta_suspensa` | `403` |
| `sessao_invalida` | `401` na renovação |
| `token_expirado` | `400` na redefinição |

---

## 5. Perfil — `/perfil`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/perfil` | 🔒 | Perfil completo do próprio usuário |
| `PUT` | `/perfil` | 🔒 | Atualiza os campos do papel |
| `POST` | `/perfil/foto` | 🔒 | Envia imagem (`multipart`, máx 2 MB) |
| `DELETE` | `/perfil/foto` | 🔒 | Remove a foto |
| `GET` | `/usuarios/{id}/publico` | 🔒 | Perfil público de aluno ou ONG |

**`GET /perfil`** devolve, para estudante:

```json
{
  "id": "...", "nome": "Maria", "email": "maria@email.com", "papel": "estudante",
  "perfil": { "nomeCompleto": "Maria Silva", "instituicao": "UniC",
              "curso": "Sistemas de Informação", "cidade": "Fortaleza", "foto": "..." },
  "perfilCompleto": true
}
```

`perfilCompleto` implementa a RN-45 — é o que a interface consulta para decidir se libera a
inscrição ou manda preencher o perfil antes.

---

## 6. Atividades — `/atividades`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/atividades` | 🌐 | **Vitrine.** Paginada, filtrada no servidor |
| `GET` | `/atividades/{id}` | 🌐 | Detalhe público |
| `GET` | `/atividades/minhas` | 🏢 | Atividades da ONG logada. Paginada |
| `POST` | `/atividades` | 🏢 | Cria como rascunho |
| `PUT` | `/atividades/{id}` | 🏢 | Edita (travas da RN-12) |
| `POST` | `/atividades/{id}/publicar` | 🏢 | Rascunho → publicada |
| `POST` | `/atividades/{id}/cancelar` | 🏢 | Cancela e notifica inscritos |
| `POST` | `/atividades/{id}/finalizar` | 🏢 | Valida presenças e emite certificados |
| `DELETE` | `/atividades/{id}` | 🏢 | **Só rascunho** (RN-18) |
| `GET` | `/atividades/{id}/inscricoes` | 🏢 | Lista de inscritos. Paginada |

**`GET /atividades`** — filtros: `busca` · `cidade` · `cargaMin` · `cargaMax` · `comVaga`

Devolve só `publicada` com `data >= hoje` (RN da seção 5 da especificação). Cada item:

```json
{
  "id": "...", "titulo": "Mutirão de limpeza",
  "data": "2026-06-15", "horaInicio": "08:00", "horaFim": "12:00",
  "local": "Praça Central", "cidade": "Fortaleza", "cargaHoraria": 4,
  "vagasMax": 20, "vagasOcupadas": 12, "vagasRestantes": 8,
  "exigeAprovacao": false,
  "situacao": "publicada",
  "ong": { "id": "...", "nome": "ONG Verde Vida", "verificada": true },
  "minhaInscricao": { "id": "...", "situacao": "confirmada" }
}
```

`vagasOcupadas` é contagem, **nunca a lista de nomes** (RN-47). `minhaInscricao` vem nulo
para visitante e para quem não se inscreveu — é o que define qual botão o cartão mostra.

`situacao` já vem **calculada** (RN-54): pode valer `em_andamento` mesmo o banco guardando
`publicada`.

**`POST /atividades`**

```json
{
  "titulo": "Mutirão de limpeza", "descricao": "...", "local": "Praça Central",
  "cidade": "Fortaleza", "estado": "CE",
  "data": "2026-06-15", "horaInicio": "08:00", "horaFim": "12:00",
  "cargaHoraria": 4, "vagasMin": 1, "vagasMax": 20,
  "exigeAprovacao": false
}
```

`cargaHoraria` é opcional — omitida, o servidor calcula pelo horário (RN-48).

| Código de erro | Situação |
|---|---|
| `data_no_passado` | `400` (RN-05) |
| `horario_invalido` | `400` (RN-06) |
| `vagas_incoerentes` | `400` (RN-08) |
| `vagas_abaixo_dos_inscritos` | `400` (RN-13) |
| `edicao_bloqueada_com_inscritos` | `400` (RN-12) |
| `nao_e_dono` | `403` (RN-11) |
| `so_rascunho_pode_ser_excluido` | `403` (RN-18) |
| `presencas_pendentes` | `400` ao finalizar (RN-03) |

---

## 7. Inscrições — `/inscricoes`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `POST` | `/inscricoes` | 🎓 | Inscreve-se numa atividade |
| `GET` | `/inscricoes/minhas` | 🎓 | Inscrições do aluno. Paginada |
| `POST` | `/inscricoes/{id}/cancelar` | 🎓 | Desiste (RN-20) |
| `POST` | `/inscricoes/{id}/aprovar` | 🏢 | Aprova pendente |
| `POST` | `/inscricoes/{id}/recusar` | 🏢 | Recusa **sem motivo** (D8) |
| `POST` | `/inscricoes/aprovar-lote` | 🏢 | Aprova várias de uma vez |
| `PUT` | `/inscricoes/{id}/presenca` | 🏢 | Marca presente ou ausente |

**`POST /inscricoes`** → `{ "atividadeId": "..." }`

| Código de erro | Situação |
|---|---|
| `ja_inscrito` | `409` (RN-01) |
| `vagas_esgotadas` | `400` (RN-09) |
| `inscricoes_encerradas` | `400` (RN-10) |
| `perfil_incompleto` | `422` (RN-45) — o corpo diz quais campos faltam |
| `limite_de_inscricoes` | `422` (RN-46) |
| `cancelamento_fora_do_prazo` | `400` (RN-20) |

**`PUT /inscricoes/{id}/presenca`** → `{ "situacao": "presente" }`

> **Esta rota confere propriedade.** É a correção da falha L2 registrada em
> [requisitos.md](requisitos.md), em que uma ONG conseguia marcar presença em atividade
> alheia. A checagem vem do serviço, não só do papel (RN-11).

---

## 8. Check-in — `/checkin`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/atividades/{id}/checkin/token` | 🏢 | Token atual do QR. Renova a cada ~30 s |
| `GET` | `/atividades/{id}/checkin/painel` | 🏢 | Quem já chegou, para a lista ao vivo |
| `POST` | `/checkin` | 🎓 | Registra o check-in com o token lido |
| `POST` | `/atividades/{id}/checkin/manual` | 🏢 | Registra por um aluno sem celular |

**`GET .../checkin/token`**

```json
{ "token": "MH1.a8f3...", "expiraEm": "2026-06-15T11:30:30-03:00", "validoPor": 30 }
```

O token é **derivado do tempo** (D31) — nada é gravado. O cliente busca de novo quando
`validoPor` acabar.

**`POST /checkin`** → `{ "token": "MH1.a8f3..." }`

| Código de erro | Situação |
|---|---|
| `token_expirado` | `400` — **caso comum**, não falha (FE-05 E1) |
| `token_de_outra_atividade` | `400` |
| `checkin_ja_registrado` | `409` |
| `checkin_fora_da_janela` | `400` (RN-21) |
| `sem_inscricao_confirmada` | `403` |
| `fora_do_local` | `400` — só com geolocalização ativa |

---

## 9. Certificados — `/certificados`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/certificados/meus` | 🎓 | Certificados do aluno. Paginada |
| `GET` | `/certificados/{id}/pdf` | 🔒 | PDF do próprio certificado |
| `GET` | `/certificados/verificar/{codigo}` | 🌐 | **Verificação pública.** 60/min por IP (RN-52) |
| `GET` | `/certificados/verificar/{codigo}/pdf` | 🌐 | PDF oficial pelo código |

**`GET /certificados/verificar/{codigo}`** — a resposta mais importante da API:

```json
{
  "valido": true,
  "selos": { "existe": true, "naoRevogado": true, "assinaturaConfere": true },
  "certificado": {
    "codigo": "a1b2c3d4e5f60718",
    "aluno": "Maria Silva",
    "atividade": "Mutirão de limpeza da praça",
    "organizacao": "ONG Verde Vida",
    "horas": 4,
    "dataAtividade": "2026-06-15",
    "emitidoEm": "2026-06-15T16:00:00-03:00"
  }
}
```

Os três selos são independentes e a interface mostra os três:

| Desfecho | `valido` | Selos | Status |
|---|:---:|---|---|
| Válido | `true` | todos verdadeiros | `200` |
| Revogado | `false` | `naoRevogado: false` + `motivo` | `200` |
| **Adulterado** | `false` | `assinaturaConfere: false` | `200` |
| Inexistente | `false` | `existe: false` | `404` |

> Adulterado responde `200`, não erro: **é uma resposta legítima com conteúdo importante**.
> A página precisa exibir o alerta de fraude, não uma tela de erro genérica.

---

## 10. Notificações — `/notificacoes`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/notificacoes` | 🔒 | Lista. Paginada. Filtro `apenasNaoLidas` |
| `GET` | `/notificacoes/contador` | 🔒 | Só o número de não lidas, para o sino |
| `POST` | `/notificacoes/{id}/lida` | 🔒 | Marca uma como lida |
| `POST` | `/notificacoes/lidas` | 🔒 | Marca todas |

---

## 11. Painéis — `/painel`

| Método | Rota | Acesso | Descrição |
|---|---|:---:|---|
| `GET` | `/painel/estudante` | 🎓 | Horas, certificados, pendências, destaque contextual |
| `GET` | `/painel/ong` | 🏢 | Atividades, voluntários, certificados, o que exige ação |

**`GET /painel/estudante`**

```json
{
  "horasValidadas": 12,
  "certificados": 3,
  "inscricoesAtivas": 2,
  "limiteInscricoes": 5,
  "destaque": {
    "tipo": "checkin_disponivel",
    "atividadeId": "...",
    "titulo": "Mutirão de limpeza está acontecendo agora"
  }
}
```

`destaque` é o que decide a ação principal da tela `E1`. `tipo` aceita
`checkin_disponivel` · `evento_hoje` · `certificado_novo` · `nenhum`.

---

## 12. Administração — `/admin` 👑

Todas exigem `superadmin`, e **todas são auditadas** (RN-32).

### 12.1 Visão geral e auditoria

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/visao-geral` | Números e alertas |
| `GET` | `/admin/auditoria` | Registros. Paginada. Filtros: `de` `ate` `atorId` `acao` `entidade` `apenasAdmin` `apenasEmNomeDe` |
| `GET` | `/admin/auditoria/exportar` | CSV do recorte filtrado |

> **Não existe `PUT` nem `DELETE` em auditoria** (RN-33). A ausência é a garantia.

### 12.2 Usuários

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/usuarios` | Paginada. Filtros: `papel` `situacao` `busca` |
| `GET` | `/admin/usuarios/{id}` | Detalhe, com sessões ativas |
| `POST` | `/admin/usuarios/{id}/redefinir-senha` | Dispara o link (D12) |
| `POST` | `/admin/usuarios/{id}/suspender` | Exige `motivo` |
| `POST` | `/admin/usuarios/{id}/reativar` | |
| `POST` | `/admin/usuarios/{id}/encerrar-sessoes` | Revoga todos os refresh |
| `POST` | `/admin/usuarios/{id}/entrar-como` | Abre a sessão espelho (D13) |
| `POST` | `/admin/sair-do-modo` | Encerra a sessão espelho |
| `POST` | `/admin/administradores` | Cria admin. Exige `senhaAtual` (RN-37) |

> **Não existe rota para definir senha** (RN-28). A ausência é a garantia.

| Código de erro | Situação |
|---|---|
| `nao_pode_suspender_a_si_mesmo` | `400` |
| `ultimo_admin_ativo` | `400` (RN-44) |
| `nao_pode_espelhar_admin` | `403` (RN-30) |
| `modo_somente_leitura` | `403` (RN-29) |
| `senha_atual_incorreta` | `403` (RN-37) |

### 12.3 ONGs, atividades e certificados

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/ongs` | Paginada |
| `POST` | `/admin/ongs/{id}/verificar` | Concede o selo |
| `DELETE` | `/admin/ongs/{id}/verificar` | Retira o selo |
| `GET` | `/admin/atividades` | Todas as ONGs. Paginada |
| `PUT` | `/admin/atividades/{id}` | Edita. Marca `editadaPorAdminEm` (RN-35) |
| `POST` | `/admin/atividades/{id}/cancelar` | Exige `motivo` |
| `POST` | `/admin/atividades/{id}/forcar-validacao` | Exige `motivo` e `politica` (FS-08) |
| `GET` | `/admin/certificados` | Paginada. Filtro `situacaoAssinatura` |
| `POST` | `/admin/certificados/{id}/revogar` | **Exige `motivo`** (RN-34) |
| `POST` | `/admin/certificados/{id}/reverter-revogacao` | |

> **Não existe rota para emitir certificado** (D14). A ausência é a garantia.

### 12.4 Sistema

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/sistema` | Parâmetros e impressão digital da chave |
| `POST` | `/admin/sistema/verificar-integridade` | Reconfere todas as assinaturas (FS-11) |
| `GET` | `/admin/sistema/chave-publica` | Baixa o `.pem` para auditoria externa |
| `POST` | `/admin/sistema/limpar-tokens` | Remove refresh expirados |

---

## 13. Catálogo de auditoria

A lista canônica de `acao`. Nada fora desta lista deve aparecer no log — nome inventado na
hora torna a busca inútil.

### Sessão e conta

| Ação | Quando |
|---|---|
| `conta.criada` | Cadastro |
| `sessao.iniciada` | Login bem-sucedido |
| `sessao.falha` | Login recusado (RN-42) |
| `sessao.renovada` | Refresh rotacionado |
| `sessao.encerrada` | Logout |
| `sessao.reuso_detectado` | Refresh reapresentado fora da janela |
| `sessoes.revogadas` | Admin encerrou as sessões |
| `senha.redefinicao_disparada` | Link enviado |
| `senha.redefinida` | Senha trocada |
| `perfil.atualizado` | Perfil salvo |
| `conta.suspensa` / `conta.reativada` | Ação do admin |

### Atividade

| Ação | Quando |
|---|---|
| `atividade.rascunho_criado` | Rascunho salvo |
| `atividade.publicada` | Foi ao ar |
| `atividade.editada` | Alterada pela ONG |
| `atividade.editada_por_admin` | Alterada pelo admin (RN-35) |
| `atividade.cancelada` | Cancelada |
| `atividade.excluida` | Rascunho apagado |
| `atividade.finalizada` | Presenças validadas |
| `atividade.validacao_forcada` | Admin destravou (FS-08) |

### Inscrição e presença

| Ação | Quando |
|---|---|
| `inscricao.criada` | Aluno se inscreveu |
| `inscricao.aprovada` / `inscricao.recusada` | Decisão da ONG |
| `inscricao.cancelada` | Aluno desistiu |
| `checkin.painel_aberto` | ONG abriu o QR |
| `checkin.registrado` | Check-in aceito — com `origem` |
| `checkin.token_invalido` | Tentativa recusada |
| `presenca.validada` | ONG decidiu presente ou ausente |

### Certificado

| Ação | Quando |
|---|---|
| `certificado.emitido` | Emitido e assinado |
| `certificado.revogado` | Revogado, com motivo |
| `certificado.revogacao_revertida` | Restaurado |
| `integridade.verificada` | Varredura de assinaturas |

### Administração

| Ação | Quando |
|---|---|
| `admin.criado` | Novo superadmin |
| `admin.entrou_como` / `admin.saiu_do_modo` | Sessão espelho |
| `admin.navegou_como` | Cada tela vista no modo espelho |
| `auditoria.consultada` | Alguém abriu a auditoria |
| `ong.verificada` / `ong.verificacao_removida` | Selo |

---

## 14. Mapa: tela → endpoint

| Tela | Endpoints |
|---|---|
| `T1` Portal | `GET /atividades?tamanho=6` |
| `T6` Verificar | `GET /certificados/verificar/{codigo}` |
| `T7` Entrar | `POST /auth/entrar` |
| `T8` Criar conta | `POST /auth/cadastro` |
| `E1` Painel aluno | `GET /painel/estudante` · `GET /notificacoes/contador` |
| `E2` Vitrine | `GET /atividades` · `POST /inscricoes` |
| `E3` Detalhe | `GET /atividades/{id}` |
| `E4` Inscrições | `GET /inscricoes/minhas` · `POST /inscricoes/{id}/cancelar` |
| `E5` Check-in | `POST /checkin` |
| `E6` Certificados | `GET /certificados/meus` · `GET /certificados/{id}/pdf` |
| `E7` Perfil | `GET`/`PUT /perfil` · `POST /perfil/foto` |
| `O1` Painel ONG | `GET /painel/ong` |
| `O2` Atividades | `GET /atividades/minhas` |
| `O3` Criar/editar | `POST`/`PUT /atividades` · `POST /atividades/{id}/publicar` |
| `O4` Gerenciar | `GET /atividades/{id}` · `POST .../cancelar` |
| `O5` Inscrições | `GET /atividades/{id}/inscricoes` · `POST /inscricoes/{id}/aprovar` |
| `O6` QR ao vivo | `GET .../checkin/token` · `GET .../checkin/painel` |
| `O7` Presenças | `PUT /inscricoes/{id}/presenca` · `POST /atividades/{id}/finalizar` |
| `A1` Visão geral | `GET /admin/visao-geral` |
| `A2` Auditoria | `GET /admin/auditoria` |
| `A3`/`A4` Usuários | `GET /admin/usuarios` · ações em `/admin/usuarios/{id}/*` |
| `A5` ONGs | `GET /admin/ongs` |
| `A6` Atividades | `GET`/`PUT /admin/atividades` |
| `A7` Certificados | `GET /admin/certificados` · `POST .../revogar` |
| `A8` Sistema | `GET /admin/sistema` |

---

## 15. O que muda para o frontend

| Área | Hoje | Alvo |
|---|---|---|
| Base | `/api` | `/api/v1` |
| Idioma | inglês | português |
| Identificador | `_id` | `id` |
| Listagens | array cru | objeto paginado |
| Erro | `{ message, details }` | `{ codigo, mensagem, detalhes }` |
| Inscrever | `POST /activities/{id}/join` | `POST /inscricoes` |
| Presença | `PUT /participations/{id}/validate` | `PUT /inscricoes/{id}/presenca` |
| Verificar | `GET /certificates/validate/{code}` | `GET /certificados/verificar/{codigo}` |

É uma troca ampla, mas concentrada: quase tudo vive em `services/api.js` e nas chamadas das
páginas. O campo `_id` é o que mais aparece espalhado.
