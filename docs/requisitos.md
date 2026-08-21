# Documento de Requisitos — Mais Horas

Levantado a partir do sistema implementado. Cada requisito abaixo corresponde a
comportamento que existe no código; o que ainda não existe está separado na seção
[Fora do escopo atual](#12-fora-do-escopo-atual).

---

## 1. Visão geral

O **Mais Horas** conecta estudantes que precisam cumprir horas de extensão a ONGs que
precisam de voluntários, e emite ao final um **certificado verificável publicamente por
QR Code**.

**Problema que resolve:** hoje as oportunidades de extensão são dispersas, a gestão de
voluntários é manual, e a comprovação de horas é um PDF que a coordenação não tem como
conferir.

**Objetivo do sistema:** centralizar a oferta, digitalizar a validação de presença e
tornar o certificado conferível sem depender do arquivo.

---

## 2. Atores

| Ator | Autenticação | Descrição |
|---|---|---|
| **Visitante** | Não | Qualquer pessoa não logada |
| **Estudante** | Sim (`role: student`) | Aluno que precisa cumprir horas de extensão |
| **ONG** | Sim (`role: organization`) | Organização que oferta atividades de voluntariado |
| **Verificador** | Não | Coordenação, faculdade ou empregador conferindo um certificado |

O **Verificador** é um Visitante num caso de uso específico. Ele foi separado porque é o
ator que justifica a existência do projeto — é para ele que a verificação pública existe.

> **Não existe perfil de administrador.** Não há moderação de conteúdo, gestão de usuários
> nem painel institucional da faculdade.

---

## 3. Matriz de permissões

Legenda: ✅ permitido · ❌ bloqueado (`403`) · 🔒 exige login (`401`) · — não aplicável

| Ação | Visitante | Estudante | ONG |
|---|:---:|:---:|:---:|
| Criar conta | ✅ | — | — |
| Fazer login | ✅ | — | — |
| Ver landing page | ✅ | ✅ | ✅ |
| **Listar atividades** | ✅ | ✅ | ✅ |
| Ver detalhes de uma atividade | 🔒 | ✅ | ✅ |
| Inscrever-se numa atividade | 🔒 | ✅ | ❌ |
| Ver minhas inscrições | 🔒 | ✅ | ✅ ¹ |
| Ver meus certificados | 🔒 | ✅ | ✅ ¹ |
| Ver painel do estudante | 🔒 | ✅ | ❌ |
| Criar atividade | 🔒 | ❌ | ✅ |
| Editar atividade própria | 🔒 | ❌ | ✅ |
| Editar atividade de outra ONG | 🔒 | ❌ | ❌ ² |
| Excluir atividade própria | 🔒 | ❌ | ✅ |
| Marcar presença | 🔒 | ❌ | ✅ |
| Finalizar atividade | 🔒 | ❌ | ✅ |
| Ver perfil público de aluno/ONG | 🔒 | ✅ | ✅ |
| Editar o próprio perfil | 🔒 | ✅ | ✅ |
| **Verificar certificado por código** | ✅ | ✅ | ✅ |
| **Baixar PDF público por código** | ✅ | ✅ | ✅ |

¹ Tecnicamente acessível (a rota exige apenas login), mas sem sentido de negócio — a ONG
não se inscreve em atividades. As listas voltam vazias.

² Bloqueado por checagem de propriedade no service, não pelo papel. Retorna `403 Acesso negado`.

---

## 4. Requisitos funcionais

### 4.1 Autenticação e sessão

| ID | Requisito |
|---|---|
| **RF-01** | O sistema deve permitir cadastro com nome, e-mail, senha e perfil (estudante ou ONG). O perfil padrão é estudante. |
| **RF-02** | O sistema deve permitir login com e-mail e senha, devolvendo uma sessão ativa. |
| **RF-03** | O sistema deve manter a sessão ativa entre recarregamentos de página sem pedir login novamente. |
| **RF-04** | O sistema deve renovar a sessão automaticamente quando o token de acesso expirar, sem interromper a navegação. |
| **RF-05** | O sistema deve permitir encerrar a sessão (logout), invalidando-a no servidor. |
| **RF-06** | O sistema deve limitar tentativas de login e cadastro a 20 por IP a cada 15 minutos. |
| **RF-07** | O sistema deve impedir cadastro com e-mail já existente. |

### 4.2 Perfil

| ID | Requisito |
|---|---|
| **RF-08** | O usuário deve poder consultar e editar o próprio perfil. |
| **RF-09** | O estudante deve poder informar: nome completo, sexo, data de nascimento, telefone, cidade, estado, bairro, instituição, curso, sobre mim e LinkedIn. |
| **RF-10** | A ONG deve poder informar: nome da organização, CNPJ, descrição, telefone, site, Instagram e endereço. |
| **RF-11** | O usuário deve poder enviar uma foto de perfil (imagem, máximo 2 MB). |
| **RF-12** | Usuários autenticados devem poder visualizar o perfil público de um estudante ou de uma ONG. |

### 4.3 Atividades

| ID | Requisito |
|---|---|
| **RF-13** | A ONG deve poder publicar uma atividade com título, descrição, local, data, horário de início e fim, carga horária e limites de participantes. |
| **RF-14** | A ONG deve poder listar as atividades que ela mesma publicou. |
| **RF-15** | A ONG deve poder editar uma atividade própria. |
| **RF-16** | A ONG deve poder excluir uma atividade própria. |
| **RF-17** | O sistema deve listar publicamente as atividades disponíveis. |
| **RF-18** | O estudante deve poder buscar atividades por título, local ou nome da ONG. |
| **RF-19** | Usuários autenticados devem poder ver os detalhes de uma atividade, incluindo a lista de inscritos. |

### 4.4 Inscrição e presença

| ID | Requisito |
|---|---|
| **RF-20** | O estudante deve poder se inscrever numa atividade aberta. |
| **RF-21** | O estudante deve poder acompanhar suas inscrições e o status de cada uma. |
| **RF-22** | A ONG deve poder ver a lista de inscritos de uma atividade própria. |
| **RF-23** | A ONG deve poder marcar cada inscrito como **presente** ou **ausente**. |
| **RF-24** | A ONG deve poder finalizar uma atividade, encerrando-a e emitindo os certificados. |

### 4.5 Certificado e verificação

| ID | Requisito |
|---|---|
| **RF-25** | O sistema deve emitir automaticamente um certificado para cada participante marcado como presente, ao finalizar a atividade. |
| **RF-26** | Cada certificado deve receber um código de verificação único. |
| **RF-27** | O estudante deve poder listar e baixar seus certificados em PDF. |
| **RF-28** | O PDF deve conter um QR Code apontando para a página pública de verificação. |
| **RF-29** | **Qualquer pessoa, sem login**, deve poder verificar a autenticidade de um certificado pelo código, obtendo estudante, atividade, ONG, carga horária e data de emissão. |
| **RF-30** | O sistema deve informar claramente quando um código de verificação não corresponde a nenhum certificado. |

### 4.6 Painel

| ID | Requisito |
|---|---|
| **RF-31** | O estudante deve ver um painel com total de horas validadas, número de certificados e inscrições pendentes. |
| **RF-32** | A ONG deve ver um painel com o resumo de suas atividades. |

---

## 5. Requisitos não funcionais

| ID | Requisito |
|---|---|
| **RNF-01** | **Responsividade.** A interface deve funcionar em telas a partir de 375 px — a maior parte dos estudantes acessa por celular. |
| **RNF-02** | **Idioma.** Toda a interface e as mensagens de erro devem estar em português. |
| **RNF-03** | **Senhas** devem ser armazenadas com hash forte (Argon2id), nunca em texto. |
| **RNF-04** | **O token de acesso não pode ser persistido** em `localStorage` ou `sessionStorage`, para não ser legível por script em caso de XSS. |
| **RNF-05** | **O token de renovação** deve trafegar apenas em cookie `httpOnly` e ser armazenado no servidor apenas como hash. |
| **RNF-06** | **Sessão revogável.** Deve ser possível invalidar uma sessão no servidor (logout e suspeita de roubo). |
| **RNF-07** | **Respostas de erro padronizadas** no formato `{ message, details? }`. |
| **RNF-08** | **CORS restrito** em produção — a API não deve subir sem a origem do frontend configurada. |
| **RNF-09** | **Integridade referencial** garantida no banco por chaves estrangeiras e restrições de unicidade, não apenas por validação na aplicação. |
| **RNF-10** | **Verificação sem dependência do arquivo.** A conferência do certificado deve consultar a base, nunca confiar no conteúdo do PDF. |
| **RNF-11** | **Rastreabilidade da sessão** — cada sessão registra user agent e IP de origem. |

---

## 6. Regras de negócio

| ID | Regra | Onde é garantida |
|---|---|---|
| **RN-01** | Um estudante não pode se inscrever duas vezes na mesma atividade. | Banco (`UNIQUE`) + service |
| **RN-02** | Uma participação gera no máximo um certificado. | Banco (`UNIQUE`) + service |
| **RN-03** | Uma atividade não pode ser finalizada enquanto houver participação com status pendente. | Service |
| **RN-04** | Só participações marcadas como **presente** geram certificado. | Service |
| **RN-05** | A data da atividade não pode estar no passado, na criação nem na edição. | Service |
| **RN-06** | O horário de início deve ser anterior ao de término. | Validação de entrada |
| **RN-07** | A carga horária deve ser um inteiro maior que zero. | Validação de entrada |
| **RN-08** | O máximo de participantes não pode ser menor que o mínimo. | Validação de entrada |
| **RN-09** | Não é possível se inscrever numa atividade que atingiu o limite de vagas. | Service |
| **RN-10** | Não é possível se inscrever numa atividade que não esteja com status **ativa**. | Service |
| **RN-11** | Só a ONG que criou a atividade pode editá-la, finalizá-la ou excluí-la. | Service (propriedade) |
| **RN-12** | Com participantes já inscritos, a ONG só pode alterar os limites de vagas — não data, local, título, descrição, horário ou carga horária. | Service |
| **RN-13** | O máximo de participantes não pode ser reduzido abaixo do número de inscritos. | Service |
| **RN-14** | Ao marcar presença, a carga horária da participação recebe a carga da atividade; ao marcar ausência, recebe zero. | Service |
| **RN-15** | Uma atividade sem carga horária definida não pode ser finalizada. | Service |
| **RN-16** | O total de horas do estudante é a soma das horas dos certificados emitidos. | Service |
| **RN-17** | Título, descrição e local são gravados com a primeira letra maiúscula. | Service |
| **RN-18** | O login não deve revelar se um e-mail está cadastrado — e-mail inexistente e senha errada retornam a mesma mensagem. | Service |
| **RN-19** | Excluir uma atividade remove em cascata suas inscrições e certificados. | Banco (`ON DELETE CASCADE`) |

---

## 7. Máquinas de estado

### 7.1 Atividade

```
        [criação]
            │
            ▼
       ┌─────────┐   finalizar (todas as presenças resolvidas)   ┌───────────┐
       │ ATIVA   │ ───────────────────────────────────────────►  │ FINALIZADA│
       └─────────┘                                               └───────────┘
            │                                                          │
            │ excluir                                                  │ excluir
            ▼                                                          ▼
        [removida]                                                 [removida]
```

- **ATIVA** — aceita inscrições, pode ser editada (com as restrições da RN-12)
- **FINALIZADA** — certificados emitidos, não aceita mais inscrições, não pode ser finalizada de novo
- **CANCELADA** — previsto no banco, mas **nenhuma funcionalidade define esse estado hoje**

### 7.2 Participação

```
     [aluno se inscreve]
            │
            ▼
      ┌──────────┐
      │ PENDENTE │ ◄──────────────┐
      └──────────┘                │
         │      │                 │ (a ONG pode corrigir
   ONG   │      │  ONG marca      │  a marcação enquanto
   marca │      │  ausente        │  a atividade não for
 presente│      │                 │  finalizada)
         ▼      ▼                 │
   ┌──────────┐  ┌─────────┐      │
   │ PRESENTE │  │ AUSENTE │ ─────┘
   └──────────┘  └─────────┘
         │
         │ ao finalizar a atividade
         ▼
   [certificado emitido]
```

Uma participação **pendente** impede a finalização da atividade (RN-03). É o mecanismo que
obriga a ONG a se posicionar sobre cada inscrito.

---

## 8. Fluxo principal — do anúncio ao certificado verificado

```
  ONG                        ESTUDANTE                    VERIFICADOR
   │                             │                             │
   │ 1. cria conta               │ 2. cria conta               │
   │ 3. publica atividade        │                             │
   │                             │ 4. busca e encontra         │
   │                             │ 5. inscreve-se → PENDENTE   │
   │                             │                             │
   │        ═══════ dia do evento ═══════                      │
   │                             │                             │
   │ 6. marca presença           │                             │
   │ 7. finaliza a atividade     │                             │
   │    └─► certificado emitido ─┼──► 8. baixa o PDF           │
   │                             │    (com QR Code)            │
   │                             │                             │
   │                             │ 9. entrega/mostra ─────────►│
   │                             │                             │ 10. escaneia o QR
   │                             │                             │ 11. confirma na base
```

---

## 9. Casos de uso detalhados

Cada caso traz o **caminho feliz**, os **caminhos alternativos** (variações válidas) e as
**exceções** (erros tratados).

---

### UC-01 — Criar conta

**Ator:** Visitante · **Pré-condição:** nenhuma

**Caminho feliz**

1. O visitante abre `/register`
2. Informa nome, e-mail e senha
3. Escolhe o perfil (estudante ou ONG)
4. Confirma
5. O sistema cria a conta, inicia a sessão e redireciona para o painel do perfil escolhido

**Caminhos alternativos**

- **A1 — Não escolhe perfil:** o sistema assume **estudante**
- **A2 — Já tem conta:** o visitante segue o link para `/login` (UC-02)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail já cadastrado | `409` — "Email já cadastrado" |
| E2 | E-mail em formato inválido | `400` com o campo apontado |
| E3 | Senha com menos de 6 caracteres | `400` com o campo apontado |
| E4 | Nome com menos de 2 caracteres | `400` com o campo apontado |
| E5 | Mais de 20 tentativas em 15 min | `429` — "Muitas tentativas..." |

---

### UC-02 — Entrar no sistema

**Ator:** Estudante ou ONG · **Pré-condição:** possuir conta

**Caminho feliz**

1. Abre `/login`, informa e-mail e senha
2. O sistema valida e inicia a sessão
3. Redireciona: estudante para `/dashboard`, ONG para `/org`

**Caminhos alternativos**

- **A1 — Sessão anterior ainda válida:** ao abrir o site, o sistema restaura a sessão pelo cookie e nem exibe a tela de login
- **A2 — Token de acesso expirou durante o uso:** o sistema renova automaticamente e refaz a operação, de forma transparente
- **A3 — Senha de conta antiga (backend anterior):** o login funciona normalmente e o hash é atualizado em silêncio

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail não cadastrado | `400` — "Email ou senha incorretos" (idêntica a E2, por segurança) |
| E2 | Senha errada | `400` — "Email ou senha incorretos" |
| E3 | Excesso de tentativas | `429` |
| E4 | Sessão expirada de vez (mais de 7 dias) | Volta para `/login` |
| E5 | Token de renovação reapresentado (suspeita de roubo) | Sessão encerrada; exige login novo |

---

### UC-03 — Publicar atividade

**Ator:** ONG · **Pré-condição:** logada como `organization`

**Caminho feliz**

1. Acessa `/org/create-activity`
2. Preenche título, descrição, local, data, horário de início e fim, carga horária e limites
3. Confirma
4. O sistema cria a atividade com status **ativa** e ela passa a aparecer na busca dos estudantes

**Caminhos alternativos**

- **A1 — Não informa limites:** o sistema assume mínimo 1 e máximo 20

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Data no passado | `400` — "A data da atividade não pode ser no passado" |
| E2 | Início maior ou igual ao fim | `400` — "A hora de início deve ser menor que a de fim" |
| E3 | Máximo menor que o mínimo | `400` — "Máximo de participantes não pode ser menor que o mínimo" |
| E4 | Carga horária zero ou negativa | `400` |
| E5 | Título acima de 40, descrição acima de 1500 ou local acima de 50 caracteres | `400` com o campo apontado |
| E6 | Um **estudante** tenta criar | `403` — "Acesso negado para o seu perfil" |

---

### UC-04 — Encontrar e se inscrever numa atividade

**Ator:** Estudante · **Pré-condição:** logado como `student`

**Caminho feliz**

1. Acessa `/activities`
2. Vê a lista de atividades **ativas com data futura**, ordenadas da mais próxima
3. Opcionalmente busca por título, local ou nome da ONG
4. Clica em inscrever-se
5. O sistema registra a participação como **pendente** e confirma na tela

**Caminhos alternativos**

- **A1 — Abre os detalhes antes:** vê descrição completa, ONG responsável e inscritos, e se inscreve de lá
- **A2 — Nenhuma atividade disponível:** o sistema exibe estado vazio explicativo
- **A3 — Busca sem resultado:** o sistema exibe estado vazio

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Já inscrito nessa atividade | `400` — "Você já está inscrito" |
| E2 | Vagas esgotadas | `400` — "Atividade lotada" |
| E3 | Atividade já finalizada | `400` — "Atividade lotada ou encerrada" |
| E4 | Atividade excluída nesse meio-tempo | `400` — "Atividade lotada ou encerrada" |
| E5 | Uma **ONG** tenta se inscrever | `403` |
| E6 | Visitante não logado tenta abrir os detalhes | `401`, redirecionado ao login |

---

### UC-05 — Registrar presença

**Ator:** ONG · **Pré-condição:** ser dona da atividade, que deve ter inscritos

**Caminho feliz**

1. Acessa `/org/activity/:id/participants`
2. Vê a lista de inscritos, cada um com seu status
3. Marca cada participante como **presente** ou **ausente**
4. O sistema atualiza o status e atribui a carga horária (RN-14)

**Caminhos alternativos**

- **A1 — Corrigir uma marcação:** a ONG remarca; o sistema sobrescreve e recalcula as horas
- **A2 — Nenhum inscrito:** exibe estado vazio; a atividade pode ser finalizada sem gerar certificados

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Participação inexistente | `404` — "Participação não encontrada" |
| E2 | Atividade sem carga horária ao marcar presente | `400` — "Atividade sem carga horária definida" |
| E3 | Um **estudante** tenta marcar presença | `403` |

> **Atenção — limitação atual:** a validação de presença **não checa se quem marca é dono da
> atividade**. Qualquer conta com perfil ONG pode marcar presença em qualquer participação
> cujo identificador conheça. Ver [Lacunas](#11-lacunas-identificadas).

---

### UC-06 — Finalizar atividade e emitir certificados

**Ator:** ONG · **Pré-condição:** ser dona da atividade, com status ativa

**Caminho feliz**

1. Acessa os detalhes da atividade e aciona "Finalizar"
2. Confirma no diálogo
3. O sistema verifica que não há pendências
4. Emite um certificado para cada presente, com código único
5. Muda o status da atividade para **finalizada**
6. Informa quantos certificados foram gerados

**Caminhos alternativos**

- **A1 — Todos ausentes:** a atividade é finalizada e **nenhum** certificado é gerado
- **A2 — Sem inscritos:** a atividade é finalizada e nenhum certificado é gerado
- **A3 — Algum presente já tinha certificado:** o existente é preservado e não se duplica

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Existe participação pendente | `400` — "Finalize a presença de todos os participantes antes de encerrar a atividade" |
| E2 | Atividade já finalizada | `400` — "Atividade já finalizada ou cancelada" |
| E3 | Carga horária inválida | `400` — "Carga horária inválida..." |
| E4 | ONG não é a criadora | `403` — "Acesso negado" |
| E5 | Atividade inexistente | `404` |

---

### UC-07 — Consultar e baixar certificado

**Ator:** Estudante · **Pré-condição:** ter ao menos um certificado

**Caminho feliz**

1. Acessa `/my-certificates`
2. Vê a lista com atividade, carga horária e código de verificação
3. Aciona o download
4. O sistema gera o PDF com o QR Code e o entrega

**Caminhos alternativos**

- **A1 — Nenhum certificado:** exibe estado vazio orientando a participar de uma atividade
- **A2 — Compartilhar sem o PDF:** o estudante informa só o código de verificação

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Certificado inexistente | `404` — "Certificado não encontrado" |
| E2 | Sessão expirada | `401`, com renovação automática ou volta ao login |

---

### UC-08 — Verificar autenticidade de um certificado

**Ator:** Verificador (sem login) · **Pré-condição:** ter o QR Code ou o código

**Este é o caso de uso central do projeto.**

**Caminho feliz**

1. Escaneia o QR Code impresso no PDF
2. O navegador abre `/verificar/<código>`
3. A página consulta a API
4. Exibe: nome do estudante, atividade, ONG responsável, carga horária e data de emissão
5. O verificador confirma que o certificado é legítimo

**Caminhos alternativos**

- **A1 — Digita o código manualmente:** mesmo resultado, sem precisar do QR
- **A2 — Baixa o PDF oficial pelo código:** obtém o documento direto da fonte, não o arquivo que lhe entregaram

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Código inexistente ou adulterado | `404` com `valid: false` — a página informa que o certificado não é válido |
| E2 | Certificado apagado junto com a atividade | `404` — mesmo tratamento de E1 |

---

### UC-09 — Editar atividade

**Ator:** ONG · **Pré-condição:** ser dona da atividade

**Caminho feliz (sem inscritos)**

1. Acessa a edição da atividade
2. Altera qualquer campo
3. O sistema grava

**Caminho alternativo — com inscritos**

- **A1:** o sistema aceita **apenas** alteração dos limites de vagas. Alterações de data,
  local, título, descrição, horário ou carga horária são **silenciosamente ignoradas**
  (RN-12), para não mudar as condições sob as quais os alunos se inscreveram.

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Reduzir o máximo abaixo do número de inscritos | `400` — "O número máximo não pode ser menor que o total de inscritos (N)" |
| E2 | Nova data no passado | `400` |
| E3 | Não é a criadora | `403` |

---

### UC-10 — Excluir atividade

**Ator:** ONG · **Pré-condição:** ser dona da atividade

**Caminho feliz**

1. Aciona a exclusão e confirma
2. O sistema remove a atividade e, **em cascata, todas as inscrições e certificados dela**

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Não é a criadora | `403` |
| E2 | Atividade inexistente | `404` |

> **Atenção:** a exclusão é permitida mesmo em atividade **finalizada com certificados
> emitidos**, e os certificados são apagados junto. Um certificado já entregue a uma
> coordenação passaria a falhar na verificação. Ver [Lacunas](#11-lacunas-identificadas).

---

### UC-11 — Manter perfil

**Ator:** Estudante ou ONG · **Pré-condição:** logado

**Caminho feliz**

1. Acessa a edição de perfil
2. Preenche os campos do seu tipo de perfil
3. Opcionalmente envia uma foto
4. O sistema grava e confirma

**Caminhos alternativos**

- **A1 — Atualização parcial:** envia só os campos alterados
- **A2 — Troca de foto:** a anterior é removida do servidor
- **A3 — Sem foto:** a interface exibe as iniciais do nome

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Arquivo acima de 2 MB | `400` — "Arquivo muito grande (máx 2MB)" |
| E2 | Arquivo que não é imagem | `400` — "Arquivo não é uma imagem" |
| E3 | Campo acima do tamanho permitido | `400` com o campo apontado |

---

## 10. Fluxo de exceção transversal — sessão

Vale para **qualquer** operação autenticada.

```
requisição com token de acesso
            │
    ┌───────┴────────┐
    │                │
 válido           expirado
    │                │
    ▼                ▼
 executa      renova automaticamente
                     │
             ┌───────┴────────┐
             │                │
        renovou            falhou
             │                │
             ▼                ▼
      refaz a operação   encerra a sessão
      (transparente)     e volta ao login
```

O usuário só percebe a expiração no caso da falha — o caminho normal é invisível para ele.

---

## 11. Lacunas identificadas

Encontradas ao levantar os requisitos a partir do código. **Não são requisitos escritos e
não cumpridos** — são comportamentos ausentes ou inconsistentes que valem decisão.

| # | Lacuna | Impacto |
|---|---|---|
| **L1** | **O estudante não pode cancelar uma inscrição.** Não existe operação de cancelamento em nenhuma camada. | Alto — quem se inscreve por engano fica preso, e a ONG é obrigada a marcá-lo ausente |
| **L2** | **A validação de presença não confere se a ONG é dona da atividade.** ⚠️ *Verificado* | **Crítico** — falha de autorização: qualquer conta ONG pode marcar presença numa participação alheia |
| **L3** | **Excluir atividade finalizada apaga certificados já emitidos.** ⚠️ *Verificado* | Alto — invalida comprovação que já pode ter sido entregue à coordenação |
| **L4** | **O mínimo de participantes não é usado em nenhuma regra.** É pedido, validado, gravado e exibido, mas não impede nada. | Médio — campo que sugere uma regra inexistente |
| **L5** | **O status "cancelada" nunca é atribuído.** Existe no banco, sem funcionalidade que o produza. | Baixo — estado morto |
| **L6** | **Não há notificação alguma.** Nem e-mail nem aviso no sistema quando o certificado é emitido ou a inscrição é confirmada. | Médio — o aluno precisa voltar ao site para descobrir |
| **L7** | **A listagem pública devolve todas as atividades**, inclusive finalizadas e passadas; a filtragem é feita no navegador. | Médio — desperdício de banda que cresce com a base |
| **L8** | **A ONG não pode remover um inscrito** da atividade. | Baixo — contornável marcando ausente |
| **L9** | **Não há recuperação de senha.** Quem esquece perde o acesso. | Alto para uso real |
| **L10** | **Três endpoints existem sem interface**: inscrição alternativa, marcação de presença alternativa e emissão avulsa de certificado. | Baixo — superfície de API maior que o necessário |

### Evidência das lacunas verificadas

**L2 — falha de autorização na presença**

Cenário reproduzido: a ONG *A* cria uma atividade, um aluno se inscreve, e a ONG *B* —
que não tem relação nenhuma com aquela atividade — tenta marcar a presença dele.

| Rota | Chamada por | Resultado |
|---|---|---|
| `PUT /api/participations/:id/validate` — **usada pela interface** | ONG não dona | **`200` — marcou a presença** |
| `PATCH /api/activities/:id/attendance` — sem interface | ONG não dona | `403` — bloqueou |

A checagem de propriedade existe no sistema, mas só na rota que **nenhuma tela chama**.
A rota que a aplicação de fato usa não faz a verificação.

*Correção:* carregar a atividade da participação e comparar `created_by` com o usuário
autenticado em `app/services/participation_service.py`, no `validate_presence` —
mesma checagem que o `activity_service` já faz.

**L3 — exclusão em cascata destrói certificado emitido**

| Momento | `GET /api/certificates/validate/<código>` |
|---|---|
| Antes de excluir a atividade | `200` — certificado válido |
| Depois de excluir a atividade | `404` — `{ "valid": false }` |

Um certificado já entregue à coordenação passa a falhar na verificação, sem aviso ao
estudante. É o oposto da promessa do RNF-10.

*Correção possível:* impedir a exclusão de atividade finalizada, ou trocar a exclusão
física por arquivamento (o status `cancelada` da L5 serviria para isso).

---

## 12. Fora do escopo atual

Não implementado e **não pendente** — são decisões de escopo do MVP.

- **Check-in por QR dinâmico** — a evolução proposta para provar presença física. Documentada em [desafio-tecnico.md](desafio-tecnico.md)
- **Perfil administrador** e moderação de conteúdo
- **Painel institucional** para a faculdade acompanhar seus alunos
- **Avaliação mútua** entre estudante e ONG
- **Aplicativo móvel nativo** — hoje a resposta é a interface responsiva
- **Relatórios e exportação** (CSV, planilha) para a coordenação
- **Categorias ou áreas de atuação** das atividades
- **Recuperação de senha** (ver L9)

---

## 13. Rastreabilidade

| Documento | Conteúdo |
|---|---|
| [arquitetura.md](arquitetura.md) | Estrutura de código, rotas de tela e schema do banco |
| [api.md](api.md) | Contrato de cada endpoint |
| [autenticacao.md](autenticacao.md) | Detalhamento dos RNF-03 a RNF-06 |
| [desafio-tecnico.md](desafio-tecnico.md) | Justificativa do RF-29 e a evolução proposta |
| [deploy.md](deploy.md) | Ambientes e configuração |
