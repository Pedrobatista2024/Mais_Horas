# Modelo de Dados — Mais Horas

O banco que sustenta a [especificação](especificacao.md) e os [fluxos](fluxos.md).
É deste documento que sai a primeira migration.

---

## 1. Decisões de modelagem

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| **D26** | Idioma | **Português** em tabelas e colunas | Coerente com o resto do projeto e com a banca |
| **D27** | Perfis | **Tabelas separadas** por tipo | O banco passa a garantir que ONG tem CNPJ e aluno tem curso |
| **D28** | Base | **Schema novo** + script de carga dos dados atuais | O alvo divergiu demais para virar remendo sobre o antigo |
| **D29** | Identificador | **Só `id`** — o alias `_id` sai | Herança de MongoDB que não existe mais |
| **D30** | Check-in | **Colunas na inscrição** | Atividade é de um dia (D17): um check-in por inscrição |
| **D31** | Token do QR | **Derivado do tempo**, nada gravado | Sem lixo no banco, sem rotina de limpeza |
| **D32** | Auditoria | **Sem expurgo** por enquanto | Apagar cedo tira justamente a prova que o projeto quer ter |
| **D33** | Exclusão física | **Só rascunho** | Todo o resto sai de cena por mudança de situação |

**Convenções:** `snake_case` · chaves `UUID` com `gen_random_uuid()` · datas em `TIMESTAMPTZ`
gravadas em UTC e interpretadas em `America/Sao_Paulo` (RN-53) · toda tabela tem
`criado_em`; as mutáveis têm `atualizado_em`.

---

## 2. Visão geral

```
                        ┌──────────────┐
                        │   usuarios   │
                        └──────┬───────┘
             ┌─────────────────┼─────────────────┐
             │                 │                 │
   ┌─────────▼────────┐  ┌─────▼──────┐  ┌───────▼────────┐
   │ perfis_estudante │  │ perfis_ong │  │ tokens_sessao  │
   └──────────────────┘  └─────┬──────┘  │ tokens_senha   │
                               │         │ notificacoes   │
                               │         └────────────────┘
                        ┌──────▼───────┐
                        │  atividades  │
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │  inscricoes  │ ◄── check-in mora aqui (D30)
                        └──────┬───────┘
                               │ 1:1
                        ┌──────▼───────┐
                        │ certificados │
                        └──────────────┘

              ┌─────────────────────┐
              │ registros_auditoria │  ← referencia tudo, sem FK rígida
              └─────────────────────┘
```

**10 tabelas.** Não existe tabela de token de check-in (D31) nem de presença separada — a
presença é situação da inscrição.

---

## 3. Tabelas

### 3.1 `usuarios`

Identidade e credencial. O que é específico de cada papel mora nos perfis.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK, `gen_random_uuid()` |
| `nome` | `TEXT` | obrigatório, 2 a 120 |
| `email` | `TEXT` | obrigatório, **UNIQUE**, minúsculas |
| `senha_hash` | `TEXT` | obrigatório, Argon2id |
| `papel` | `TEXT` | `estudante` · `ong` · `superadmin` |
| `situacao` | `TEXT` | `ativa` · `suspensa`, padrão `ativa` |
| `suspenso_em` | `TIMESTAMPTZ` | nulo quando ativa |
| `suspenso_por` | `UUID` | → `usuarios(id)`, `ON DELETE SET NULL` |
| `motivo_suspensao` | `TEXT` | obrigatório ao suspender (FS-05) |
| `criado_em` / `atualizado_em` | `TIMESTAMPTZ` | `NOW()` |

```sql
CONSTRAINT usuarios_papel_valido CHECK (papel IN ('estudante','ong','superadmin')),
CONSTRAINT usuarios_situacao_valida CHECK (situacao IN ('ativa','suspensa')),
CONSTRAINT usuarios_suspensao_coerente CHECK (
  (situacao = 'ativa'    AND suspenso_em IS NULL) OR
  (situacao = 'suspensa' AND suspenso_em IS NOT NULL AND motivo_suspensao IS NOT NULL)
)
```

**Índices:** `email` (do UNIQUE) · `papel` · `situacao`

> A terceira restrição impede o estado impossível: conta marcada como suspensa sem data nem
> motivo. Regra que o banco garante não depende de ninguém lembrar dela.

---

### 3.2 `perfis_estudante`

| Coluna | Tipo | Regras |
|---|---|---|
| `usuario_id` | `UUID` | **PK e FK**, `ON DELETE CASCADE` |
| `nome_completo` | `TEXT` | máx 120 — **exigido antes da 1ª inscrição** (RN-45) |
| `instituicao` | `TEXT` | máx 120 — idem |
| `curso` | `TEXT` | máx 120 — idem |
| `sexo` | `TEXT` | máx 30 |
| `data_nascimento` | `DATE` | |
| `telefone` | `TEXT` | máx 30 |
| `cidade` / `estado` / `bairro` | `TEXT` | máx 80 |
| `sobre_mim` | `TEXT` | máx 1000 |
| `linkedin` | `TEXT` | máx 200 |
| `foto` | `TEXT` | caminho do arquivo |
| `criado_em` / `atualizado_em` | `TIMESTAMPTZ` | |

> **A chave primária é a estrangeira.** Garante um perfil por usuário, sem coluna de id
> própria. O perfil nasce junto com a conta, com os campos vazios.
>
> Os três campos da RN-45 **não são `NOT NULL`**: o perfil existe vazio desde o cadastro, e
> a exigência só vale no momento da inscrição. Fosse `NOT NULL`, seria impossível criar a
> conta antes de preencher tudo.

---

### 3.3 `perfis_ong`

| Coluna | Tipo | Regras |
|---|---|---|
| `usuario_id` | `UUID` | **PK e FK**, `ON DELETE CASCADE` |
| `nome_organizacao` | `TEXT` | máx 120 |
| `cnpj` | `TEXT` | máx 30 |
| `descricao` | `TEXT` | máx 1000 |
| `telefone` | `TEXT` | máx 30 |
| `site` / `instagram` | `TEXT` | máx 200 |
| `endereco` | `TEXT` | máx 200 |
| `cidade` / `estado` | `TEXT` | máx 80 — alimenta o filtro da vitrine |
| `logo` | `TEXT` | caminho do arquivo |
| `verificada_em` | `TIMESTAMPTZ` | selo concedido pelo admin (`A5`) |
| `verificada_por` | `UUID` | → `usuarios(id)` |
| `criado_em` / `atualizado_em` | `TIMESTAMPTZ` | |

**Índices:** `cidade` · `verificada_em`

---

### 3.4 `atividades`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK |
| `ong_id` | `UUID` | → `usuarios(id)` `ON DELETE CASCADE`, obrigatório (D24) |
| `titulo` | `TEXT` | 1 a 40 |
| `descricao` | `TEXT` | 1 a 1500 |
| `local` | `TEXT` | 1 a 50 |
| `cidade` / `estado` | `TEXT` | filtro da vitrine |
| `data` | `DATE` | **um único dia** (D17) |
| `hora_inicio` / `hora_fim` | `TIME` | fim maior que início |
| `carga_horaria` | `INTEGER` | > 0, sugerida pelo horário (RN-48) |
| `vagas_min` / `vagas_max` | `INTEGER` | ≥ 1, máx ≥ mín |
| `exige_aprovacao` | `BOOLEAN` | padrão `false` (D1) |
| `situacao` | `TEXT` | `rascunho` · `publicada` · `finalizada` · `cancelada` |
| `publicada_em` | `TIMESTAMPTZ` | |
| `finalizada_em` | `TIMESTAMPTZ` | |
| `cancelada_em` / `cancelada_por` | `TIMESTAMPTZ` / `UUID` | |
| `editada_por_admin_em` | `TIMESTAMPTZ` | alimenta o aviso da RN-35 |
| `criado_em` / `atualizado_em` | `TIMESTAMPTZ` | |

```sql
CONSTRAINT atividades_situacao_valida
  CHECK (situacao IN ('rascunho','publicada','finalizada','cancelada')),
CONSTRAINT atividades_horario_coerente CHECK (hora_fim > hora_inicio),
CONSTRAINT atividades_carga_positiva  CHECK (carga_horaria > 0),
CONSTRAINT atividades_vagas_coerentes CHECK (vagas_max >= vagas_min AND vagas_min >= 1)
```

**Índices:** `ong_id` · `situacao` · `data` · `(situacao, data)` para a vitrine · `cidade`

> **Só quatro situações** — `em_andamento` e `aguardando_validacao` **não existem no banco**
> (D22, RN-54). São calculadas, como mostra a seção 5.

---

### 3.5 `inscricoes`

O centro do domínio. Guarda o vínculo, a evidência do check-in (D30) e a decisão de presença.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK |
| `atividade_id` | `UUID` | → `atividades(id)` `ON DELETE CASCADE` |
| `usuario_id` | `UUID` | → `usuarios(id)` `ON DELETE CASCADE` |
| `situacao` | `TEXT` | `pendente` · `confirmada` · `recusada` · `cancelada` · `presente` · `ausente` |
| `respondida_em` / `respondida_por` | `TIMESTAMPTZ` / `UUID` | aprovação ou recusa (FO-05/06) |
| `cancelada_em` | `TIMESTAMPTZ` | desistência do aluno (FE-04) |
| **`checkin_em`** | `TIMESTAMPTZ` | nulo se não fez |
| **`checkin_origem`** | `TEXT` | `qr` · `manual` (RN-43) |
| **`checkin_latitude` / `checkin_longitude`** | `NUMERIC(9,6)` | opcional |
| **`checkin_registrado_por`** | `UUID` | preenchido só na origem `manual` |
| `presenca_validada_em` / `presenca_validada_por` | `TIMESTAMPTZ` / `UUID` | decisão da ONG |
| `carga_horaria_creditada` | `INTEGER` | ≥ 0, padrão 0 (RN-14) |
| `criado_em` / `atualizado_em` | `TIMESTAMPTZ` | |

```sql
CONSTRAINT inscricoes_unica UNIQUE (atividade_id, usuario_id),
CONSTRAINT inscricoes_situacao_valida CHECK (
  situacao IN ('pendente','confirmada','recusada','cancelada','presente','ausente')),
CONSTRAINT inscricoes_checkin_origem CHECK (
  checkin_origem IS NULL OR checkin_origem IN ('qr','manual')),
CONSTRAINT inscricoes_checkin_coerente CHECK (
  (checkin_em IS NULL AND checkin_origem IS NULL) OR
  (checkin_em IS NOT NULL AND checkin_origem IS NOT NULL)),
CONSTRAINT inscricoes_manual_tem_responsavel CHECK (
  checkin_origem <> 'manual' OR checkin_registrado_por IS NOT NULL)
```

**Índices:** `(atividade_id, situacao)` · `(usuario_id, situacao)` para o limite da RN-46 ·
`checkin_em`

> `inscricoes_unica` é o que garante a RN-01 no banco, não no código. Mesmo com dois cliques
> simultâneos, o segundo esbarra na restrição.
>
> `inscricoes_manual_tem_responsavel` obriga registrar **quem** fez o check-in manual — sem
> isso, a distinção de origem da RN-43 perderia metade do valor.

---

### 3.6 `certificados`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK |
| `inscricao_id` | `UUID` | → `inscricoes(id)`, **UNIQUE** (RN-02) |
| `usuario_id` | `UUID` | → `usuarios(id)`, redundante por desempenho |
| `atividade_id` | `UUID` | → `atividades(id)`, idem |
| `codigo_verificacao` | `TEXT` | **UNIQUE**, 16 hex — vai no QR |
| `horas` | `INTEGER` | > 0 |
| `nome_no_certificado` | `TEXT` | **congelado na emissão** (RN-50) |
| `nome_organizacao` | `TEXT` | congelado |
| `titulo_atividade` | `TEXT` | congelado |
| `data_atividade` | `DATE` | congelado |
| `assinatura` | `TEXT` | **`NOT NULL`** — Ed25519 em base64 (D4). Sem caso legado |
| `emitido_em` | `TIMESTAMPTZ` | |
| `revogado_em` / `revogado_por` | `TIMESTAMPTZ` / `UUID` | |
| `motivo_revogacao` | `TEXT` | obrigatório ao revogar (RN-34) |

```sql
CONSTRAINT certificados_inscricao_unica UNIQUE (inscricao_id),
CONSTRAINT certificados_codigo_unico    UNIQUE (codigo_verificacao),
CONSTRAINT certificados_revogacao_coerente CHECK (
  (revogado_em IS NULL AND motivo_revogacao IS NULL) OR
  (revogado_em IS NOT NULL AND motivo_revogacao IS NOT NULL))
```

**Índices:** `codigo_verificacao` · `usuario_id` · `atividade_id` · `revogado_em`

> **Os campos congelados são o ponto mais importante desta tabela.** Nome do aluno, da ONG,
> título e data são **copiados na emissão**, não lidos por join na hora de verificar.
>
> Duas razões. Primeira: se a ONG trocar de nome depois, o certificado tem de continuar
> dizendo o que dizia quando foi emitido. Segunda, e decisiva: **a assinatura é calculada
> sobre esses valores**. Se eles pudessem mudar por join, a assinatura passaria a não bater
> e todo certificado antigo apareceria como adulterado.

---

### 3.7 `tokens_sessao`

Refresh tokens, com rotação e detecção de reuso.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK |
| `usuario_id` | `UUID` | → `usuarios(id)` `ON DELETE CASCADE` |
| `token_hash` | `VARCHAR(64)` | **UNIQUE**, SHA-256 — nunca o token em claro |
| `familia_id` | `UUID` | agrupa a linhagem de um login |
| `expira_em` | `TIMESTAMPTZ` | |
| `usado_em` | `TIMESTAMPTZ` | marcado ao rotacionar |
| `revogado_em` | `TIMESTAMPTZ` | logout ou revogação da família |
| `em_nome_de` | `UUID` | preenchido na sessão espelho do admin (D13) |
| `user_agent` / `ip` | `VARCHAR` | contexto |
| `criado_em` | `TIMESTAMPTZ` | |

**Índices:** `token_hash` · `usuario_id` · `familia_id` · `expira_em`

> `em_nome_de` é o que faz o modo "entrar como" funcionar: a sessão sabe que é o admin
> observando outra conta, e toda escrita é recusada enquanto esse campo estiver preenchido
> (RN-29).

---

### 3.8 `tokens_redefinicao_senha`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK |
| `usuario_id` | `UUID` | → `usuarios(id)` `ON DELETE CASCADE` |
| `token_hash` | `VARCHAR(64)` | **UNIQUE**, SHA-256 |
| `expira_em` | `TIMESTAMPTZ` | 1 hora após a criação |
| `usado_em` | `TIMESTAMPTZ` | uso único |
| `disparado_por` | `UUID` | preenchido quando foi o admin (FS-03) |
| `criado_em` | `TIMESTAMPTZ` | |

**Índices:** `token_hash` · `usuario_id`

---

### 3.9 `notificacoes`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `UUID` | PK |
| `destinatario_id` | `UUID` | → `usuarios(id)` `ON DELETE CASCADE` |
| `tipo` | `TEXT` | `inscricao.aprovada`, `certificado.emitido`… |
| `titulo` / `mensagem` | `TEXT` | texto exibido |
| `link` | `TEXT` | destino ao clicar |
| `lida_em` | `TIMESTAMPTZ` | nulo enquanto não lida |
| `criado_em` | `TIMESTAMPTZ` | |

**Índices:** `(destinatario_id, lida_em)` — alimenta o contador do sino

---

### 3.10 `registros_auditoria`

**Somente inserção** (RN-33). Nenhum caminho da aplicação faz `UPDATE` ou `DELETE` aqui.

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `BIGSERIAL` | PK — sequencial, ordem cronológica de graça |
| `ator_id` | `UUID` | quem executou; nulo em ação do sistema |
| `ator_papel` | `TEXT` | papel no momento da ação |
| `em_nome_de_id` | `UUID` | preenchido no modo "entrar como" (D13) |
| `acao` | `TEXT` | verbo canônico |
| `entidade` / `entidade_id` | `TEXT` / `UUID` | o que foi afetado |
| `antes` / `depois` | `JSONB` | só os campos que mudaram |
| `ip` | `INET` | |
| `user_agent` | `TEXT` | |
| `ocorrido_em` | `TIMESTAMPTZ` | |

**Índices:** `ocorrido_em DESC` · `ator_id` · `acao` · `(entidade, entidade_id)` ·
`em_nome_de_id`

> **Sem chave estrangeira para `usuarios`.** É proposital: o registro de auditoria precisa
> sobreviver mesmo que a conta suma um dia. Uma FK com `CASCADE` apagaria justamente a
> trilha do usuário que se quer investigar.
>
> `BIGSERIAL` em vez de UUID porque aqui a ordem cronológica importa mais que a
> imprevisibilidade, e a tabela cresce muito mais que as outras.

---

## 4. Domínios

| Campo | Valores |
|---|---|
| `usuarios.papel` | `estudante` · `ong` · `superadmin` |
| `usuarios.situacao` | `ativa` · `suspensa` |
| `atividades.situacao` | `rascunho` · `publicada` · `finalizada` · `cancelada` |
| `inscricoes.situacao` | `pendente` · `confirmada` · `recusada` · `cancelada` · `presente` · `ausente` |
| `inscricoes.checkin_origem` | `qr` · `manual` |

Todos como `TEXT` + `CHECK`, não como `ENUM` do Postgres: adicionar valor a um `ENUM` exige
`ALTER TYPE`, que trava a tabela; mudar um `CHECK` é migration simples.

---

## 5. Consultas que sustentam as regras

### 5.1 Situação real da atividade (D22, RN-54)

```sql
CASE
  WHEN a.situacao <> 'publicada' THEN a.situacao
  WHEN (a.data + a.hora_inicio) AT TIME ZONE 'America/Sao_Paulo' > NOW() THEN 'publicada'
  WHEN (a.data + a.hora_fim)    AT TIME ZONE 'America/Sao_Paulo' < NOW() THEN 'aguardando_validacao'
  ELSE 'em_andamento'
END AS situacao_real
```

Vira uma `VIEW` chamada `atividades_com_situacao`, para não repetir a expressão.

### 5.2 Vagas ocupadas (RN-19)

```sql
SELECT COUNT(*) FROM inscricoes
WHERE atividade_id = $1
  AND situacao IN ('pendente','confirmada','presente','ausente');
```

`recusada` e `cancelada` ficam de fora — devolvem a vaga.

### 5.3 Limite de inscrições do aluno (RN-46)

```sql
SELECT COUNT(*) FROM inscricoes i
JOIN atividades a ON a.id = i.atividade_id
WHERE i.usuario_id = $1
  AND i.situacao IN ('pendente','confirmada')
  AND a.situacao = 'publicada'
  AND (a.data + a.hora_fim) AT TIME ZONE 'America/Sao_Paulo' > NOW();
```

Conta só o que ainda vai acontecer — atividade passada não ocupa a cota.

### 5.4 Vitrine (seção 5 da especificação)

```sql
SELECT * FROM atividades
WHERE situacao = 'publicada' AND data >= CURRENT_DATE
ORDER BY data ASC, hora_inicio ASC;
```

Filtro **no servidor**, não no navegador — corrige a lacuna L7 de [requisitos.md](requisitos.md).

### 5.5 Perfil mínimo (RN-45)

```sql
SELECT (nome_completo IS NOT NULL AND btrim(nome_completo) <> ''
    AND instituicao   IS NOT NULL AND btrim(instituicao)   <> ''
    AND curso         IS NOT NULL AND btrim(curso)         <> '') AS perfil_completo
FROM perfis_estudante WHERE usuario_id = $1;
```

---

## 6. Onde cada regra é garantida

O banco só protege o que dá para expressar em restrição. O resto é do serviço — e precisa
de teste, porque não há rede embaixo.

### Garantidas pelo banco

| Regra | Mecanismo |
|---|---|
| RN-01 inscrição única | `UNIQUE (atividade_id, usuario_id)` |
| RN-02 um certificado por inscrição | `UNIQUE (inscricao_id)` |
| RN-06 horário coerente | `CHECK (hora_fim > hora_inicio)` |
| RN-07/48 carga positiva | `CHECK (carga_horaria > 0)` |
| RN-08 vagas coerentes | `CHECK (vagas_max >= vagas_min)` |
| RN-24 código único | `UNIQUE (codigo_verificacao)` |
| RN-34 revogação com motivo | `CHECK` de coerência |
| RN-43 origem do check-in | `CHECK` de origem e responsável |
| RN-49 um único dia | coluna `DATE`, sem data de fim |
| RN-55 uma ONG por atividade | coluna `ong_id` única, sem tabela de junção |

### Garantidas pelo serviço

| Regra | Onde |
|---|---|
| RN-03 não finaliza com pendência | `atividade_service.finalizar` |
| RN-05 data não pode ser passada | validação de entrada + serviço |
| RN-09/10 vaga e situação na inscrição | `inscricao_service.criar` |
| RN-11 propriedade | dependência da rota + verificação no serviço |
| RN-12/13 trava de edição com inscritos | `atividade_service.editar` |
| RN-18 só rascunho é apagado | `atividade_service.excluir` |
| RN-20 cancelamento até o início | `inscricao_service.cancelar` |
| RN-21/22 janela e token do check-in | `checkin_service` |
| RN-29/30/31 modo espelho | dependência de sessão |
| RN-38 revogar sessões ao trocar senha | `usuario_service.redefinir_senha` |
| RN-41 emissão atômica | transação em `atividade_service.finalizar` |
| RN-45/46 perfil e limite | `inscricao_service.criar` |
| RN-44 ao menos um admin | `usuario_service.suspender` |

> **RN-41 depende de transação, não de restrição.** A emissão dos certificados roda dentro
> de uma transação só: falhou a assinatura no oitavo de catorze, tudo volta atrás.

---

## 7. Migração dos dados atuais (D28)

Schema novo em base limpa, com script de carga preservando o que existe.

| De (hoje) | Para | Observação |
|---|---|---|
| `users` | `usuarios` + `perfis_estudante` / `perfis_ong` | O JSONB é desmembrado em colunas |
| `users.role` | `usuarios.papel` | `student` → `estudante`, `organization` → `ong` |
| `users.password` | `usuarios.senha_hash` | **Hash bcrypt é preservado** e vira Argon2id no primeiro login |
| `activities` | `atividades` | `created_by` → `ong_id`; `active` → `publicada` |
| `participations` | `inscricoes` | `pending` → `pendente`, `present` → `presente`, `absent` → `ausente` |
| `certificates` | — | **Não migrados** — eram teste, e sem assinatura |
| `refresh_tokens` | `tokens_sessao` | Ou simplesmente descartada, forçando login novo |
| `uploads/*.png` | mantidos | Os caminhos são reescritos nos perfis |

### Os certificados já emitidos

**Não são migrados.** Os certificados que existem hoje na base foram gerados em teste, não
têm assinatura (são anteriores a D4) e não pertencem a ninguém de verdade.

Isso fecha a única questão que estava em aberto aqui e evita o pior caminho: **assinar
retroativamente**, que seria o sistema afirmar uma garantia que não tinha na hora da
emissão.

> Como consequência, `certificados.assinatura` nasce **`NOT NULL`**: todo certificado do
> sistema novo é assinado, sem exceção nem caso legado para tratar na verificação. Um campo
> a menos que pode vir nulo é uma condição a menos para errar depois.

Se algum dia for preciso importar certificado de outro sistema, aí sim se cria o conceito
de certificado legado — mas com o desenho pensado para isso, não como resíduo de migração.

---

## 8. Ordem das migrations

```
0001_usuarios_e_perfis      usuarios, perfis_estudante, perfis_ong
0002_atividades             atividades + índices da vitrine
0003_inscricoes             inscricoes com as colunas de check-in
0004_certificados           certificados com campos congelados e assinatura
0005_sessao_e_senha         tokens_sessao, tokens_redefinicao_senha
0006_notificacoes           notificacoes
0007_auditoria              registros_auditoria
0008_view_situacao          VIEW atividades_com_situacao
```

Cada uma depende só das anteriores. `0008` vem por último porque a `VIEW` referencia
`atividades`.

---

## 9. O que mudou em relação ao banco atual

| | Hoje | Alvo |
|---|---|---|
| Tabelas | 5 | **10** |
| Idioma | inglês | **português** |
| Perfis | JSONB dentro de `users` | **tabelas próprias com restrição** |
| Situações da atividade | 3 (1 sem uso) | 4 gravadas + 2 calculadas |
| Situações da inscrição | 3 | 6 |
| Check-in | não existe | colunas em `inscricoes` |
| Assinatura do certificado | não existe | `assinatura` + campos congelados |
| Revogação | não existe | `revogado_em` + motivo |
| Notificação | não existe | tabela `notificacoes` |
| Auditoria | não existe | tabela somente inserção |
| Redefinição de senha | não existe | `tokens_redefinicao_senha` |
| Alias `_id` | exposto pela API | **removido** (D29) |
