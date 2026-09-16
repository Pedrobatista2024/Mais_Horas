# Especificação Funcional — Mais Horas

**O sistema que vamos construir.** Este documento é o alvo: define atores, estados, telas,
botões e regras antes de escrever código.

> Não confundir com [requisitos.md](requisitos.md), que descreve o sistema **como ele está
> hoje**. Onde os dois divergirem, este documento manda — o código é que precisa mudar.

---

## 1. Decisões de produto

Tomadas antes do desenho, porque cada uma ramifica tudo o que vem depois.

| # | Decisão | Escolha | Consequência |
|---|---|---|---|
| **D1** | Inscrição | **A ONG escolhe por atividade**: automática ou com aprovação | Inscrição ganha o estado `pendente` |
| **D2** | Perfil da coordenação | **Não existe** — a verificação pública basta | Só dois perfis autenticados |
| **D3** | Presença | **Check-in por QR dinâmico + confirmação da ONG** | Entidade `CheckIn` e telas novas dos dois lados |
| **D4** | Certificado | **Assinado criptograficamente** (Ed25519) | Fraude por escrita no banco passa a ser detectável |
| **D5** | Cancelamento | **O aluno desiste até o evento começar** | Inscrição ganha o estado `cancelada`, e a vaga volta |
| **D6** | Rascunho | **A ONG monta a atividade antes de publicar** | Atividade ganha o estado `rascunho` |
| **D7** | Vitrine | **A atividade fica visível mesmo lotada**, e some quando o dia do evento passa | "Lotada" é condição calculada, não estado |
| **D8** | Recusa | **Sem justificativa** — o aluno vê uma mensagem genérica | Nenhum campo de motivo |
| **D9** | Porta de entrada | **Portal público** apresenta a plataforma; o sistema vive dentro dele | Login único para todos os perfis |
| **D10** | Estrutura | **Uma aplicação, quatro zonas visuais**: portal, app do aluno, painel da ONG, console admin | Um deploy, sem duplicar componentes |
| **D11** | Superadmin | **Existe**, com acesso operacional total. Criado por comando, nunca por cadastro público | Terceiro perfil autenticado |
| **D12** | Senha pelo admin | **Dispara redefinição** — o admin nunca vê nem define senha | Preserva a não-repúdio |
| **D13** | Suporte | **"Entrar como" somente leitura**, com tarja permanente e trilha de auditoria | Admin nunca age disfarçado de usuário |
| **D14** | Certificado pelo admin | **Só revoga, nunca emite** | Certificado sempre tem presença real por trás |
| **D15** | Recuperação de senha | **Entra na v1** — é pré-requisito de D12 | Exige envio de e-mail desde o início |
| **D16** | Notificação | **Aviso dentro do sistema na v1**, e-mail depois | Entidade `Notificacao` e sino no cabeçalho |
| **D17** | Duração | **Uma atividade ocupa um único dia** | Mutirão de fim de semana vira duas atividades |
| **D18** | Carga horária | **Calculada do horário, ajustável pela ONG** | Evita erro de digitação sem engessar |
| **D19** | Perfil | **Dados mínimos obrigatórios antes da 1ª inscrição** | A ONG aprova com informação; certificado sai com nome certo |
| **D20** | Limite de inscrições | **Até 5 ativas por aluno** | Impede que um aluno segure vaga em tudo |
| **D21** | Privacidade | **O aluno vê só a contagem de inscritos**, não os nomes | A ONG continua vendo a lista completa |
| **D22** | Transições por tempo | **Estado calculado na leitura**, sem tarefa agendada | Nada quebra se o servidor hibernar |
| **D23** | Emissor | **A ONG emite, a plataforma atesta** | O PDF traz a ONG como responsável |
| **D24** | Autoria | **Uma atividade tem uma ONG** | Parceria fica para depois |
| **D25** | Fuso horário | **`America/Sao_Paulo`**, gravado em UTC | Sem ambiguidade em "chegou a hora" |

---

## 2. Glossário

Termos com um significado só, no código e na interface.

| Termo | Significa | Não confundir com |
|---|---|---|
| **Atividade** | A oportunidade de voluntariado publicada pela ONG | — |
| **Vitrine** | A listagem pública de atividades disponíveis | — |
| **Inscrição** | O vínculo entre um aluno e uma atividade | Check-in |
| **Vaga** | Uma posição na atividade. Ocupada por inscrição `confirmada` ou `pendente` | — |
| **Check-in** | O registro de que o aluno escaneou o QR no local | Presença |
| **Presença** | A decisão final da ONG sobre o aluno ter participado | Check-in |
| **Certificado** | O comprovante emitido para quem teve presença confirmada | PDF |
| **Código de verificação** | O identificador público do certificado, carregado no QR | — |

> **Check-in ≠ presença.** O check-in é a *evidência*; a presença é a *decisão*. A ONG
> decide olhando as evidências. Manter essa distinção evita confusão em todo o resto.

---

## 3. Atores

| Ator | Autenticação | Objetivo |
|---|---|---|
| **Visitante** | Não | Entender o que é a plataforma e criar conta |
| **Estudante** | `student` | Cumprir suas horas de extensão e comprová-las |
| **ONG** | `organization` | Conseguir voluntários e reconhecê-los sem trabalho manual |
| **Verificador** | Não | Confirmar, em segundos, que um certificado é verdadeiro |
| **Superadmin** | `superadmin` | Operar, auditar e destravar o sistema |

O **Verificador** — coordenação de curso, faculdade, empregador — nunca cria conta. É para
ele que a verificação pública existe, e é o ator que justifica o projeto.

O **Superadmin** é operador da plataforma, não usuário do domínio: não se inscreve em
atividade nem publica vaga. Ele existe para investigar problema, destravar usuário e
responder por incidente.

> **Conta criada por comando**, nunca por cadastro público. Não há tela para virar admin.
> O primeiro é criado no servidor com `python -m app.cli criar-admin`; os demais, por um
> admin existente. Toda criação é auditada.

---

## 4. Entidades e estados

### 4.1 Atividade

```
   ┌──────────┐   publicar    ┌───────────┐   chega a hora   ┌──────────────┐
   │ RASCUNHO │──────────────►│ PUBLICADA │─────────────────►│ EM ANDAMENTO │
   └──────────┘               └───────────┘                  └──────┬───────┘
        │                           │                               │
        │ excluir                   │ cancelar                      │ evento termina
        ▼                           ▼                               ▼
   [removida]                 ┌───────────┐              ┌────────────────────┐
                              │ CANCELADA │              │     AGUARDANDO     │
                              └───────────┘              │     VALIDAÇÃO      │
                            (avisa os inscritos)         └─────────┬──────────┘
                                                                   │ ONG conclui
                                                                   ▼
                                                          ┌────────────────┐
                                                          │   FINALIZADA   │
                                                          └────────────────┘
                                                         (certificados emitidos)
```

| Estado | O que significa | Aceita inscrição? | Visível na vitrine? |
|---|---|:---:|:---:|
| `rascunho` | Só a ONG vê. Ainda sendo montada | ❌ | ❌ |
| `publicada` | No ar, aceitando gente | ✅ *se houver vaga* | ✅ *se a data não passou* |
| `em_andamento` | É o dia e a hora. **Check-in liberado** | ❌ | ✅ |
| `aguardando_validacao` | Acabou. A ONG precisa confirmar as presenças | ❌ | ❌ |
| `finalizada` | Presenças confirmadas, certificados emitidos | ❌ | ❌ |
| `cancelada` | A ONG desistiu de realizar | ❌ | ❌ |

**Transições por tempo — calculadas, não agendadas (D22)**

`em_andamento` e `aguardando_validacao` **não são gravados no banco**: saem da combinação
entre o status armazenado e o relógio.

```
status gravado = publicada
        │
        ├─ agora < início           → publicada
        ├─ início ≤ agora ≤ término → em_andamento
        └─ agora > término          → aguardando_validacao

status gravado = finalizada | cancelada | rascunho  → é o próprio
```

Só `rascunho`, `publicada`, `finalizada` e `cancelada` existem como valor no banco. Isso
elimina a necessidade de processo em segundo plano — que falharia em silêncio se caísse, e
que não roda de forma confiável em serviço que hiberna por inatividade.

Todos os horários são interpretados em **`America/Sao_Paulo`** e gravados em UTC (D25).

### 4.2 Condições calculadas — não são estados

| Condição | Cálculo | Efeito na interface |
|---|---|---|
| **Lotada** | vagas ocupadas ≥ máximo | Botão de inscrição vira "Vagas esgotadas", desabilitado. **A atividade continua na vitrine** (D7) |
| **Vagas restantes** | máximo − ocupadas | Exibido no cartão: "3 vagas restantes" |
| **Já inscrito** | existe inscrição ativa do aluno | Botão vira "Cancelar inscrição" |
| **Inscrições do aluno** | inscrições ativas dele no sistema | Ao chegar em 5, o botão de inscrever desabilita (D20) |

Uma vaga é ocupada por inscrição `pendente` **ou** `confirmada` — quem está aguardando
aprovação já segura o lugar. Cancelamento e recusa devolvem a vaga.

### 4.3 Inscrição

```
                    aluno clica em "Inscrever-se"
                                 │
              ┌──────────────────┴──────────────────┐
              │ atividade exige                      │ atividade é
              │ aprovação (D1)                       │ automática
              ▼                                      │
        ┌───────────┐                                │
        │ PENDENTE  │                                │
        └─────┬─────┘                                │
              │                                      │
      ┌───────┴────────┐                             │
   ONG aceita      ONG recusa                        │
      │                │                             │
      │                ▼                             │
      │          ┌───────────┐                       │
      │          │ RECUSADA  │ (sem motivo, D8)      │
      │          └───────────┘                       │
      ▼                                              ▼
   ┌────────────────────────────────────────────────────┐
   │                    CONFIRMADA                       │
   └───────────────────────┬────────────────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │ aluno desiste                        │ evento acontece
        │ (antes de começar, D5)               │
        ▼                                      ▼
  ┌────────────┐                    ┌──────────┐   ┌─────────┐
  │ CANCELADA  │                    │ PRESENTE │   │ AUSENTE │
  └────────────┘                    └────┬─────┘   └─────────┘
                                         │
                                         ▼
                                   certificado emitido
```

| Estado | Ocupa vaga? | O aluno pode cancelar? |
|---|:---:|:---:|
| `pendente` | ✅ | ✅ |
| `confirmada` | ✅ | ✅ *até o evento começar* |
| `recusada` | ❌ | — |
| `cancelada` | ❌ | — |
| `presente` | ✅ | ❌ |
| `ausente` | ✅ | ❌ |

### 4.4 Check-in

Registro de evidência. Não muda o estado da inscrição sozinho — alimenta a decisão da ONG.

| Campo | Para quê |
|---|---|
| `inscricao_id` | De quem é |
| `registrado_em` | Comprova que foi durante o evento |
| `token_usado` | Amarra ao QR daquele instante; impede reuso |
| `latitude`, `longitude` | Opcional — camada extra contra check-in remoto |

### 4.5 Certificado

| Campo | Observação |
|---|---|
| `codigo_verificacao` | Público, vai no QR |
| `assinatura` | Ed25519 sobre os dados canônicos (D4) |
| `emitido_em` | — |
| `revogado_em` | Permite invalidar sem apagar o registro |

### 4.6 Notificação

Aviso dentro do sistema (D16). Sino no cabeçalho, com contador de não lidas.

| Campo | Conteúdo |
|---|---|
| `destinatario_id` | Quem recebe |
| `tipo` | `inscricao.aprovada`, `inscricao.recusada`, `atividade.cancelada`, `certificado.emitido`, `certificado.revogado` |
| `titulo` / `mensagem` | Texto exibido |
| `link` | Para onde leva ao clicar |
| `lida_em` | Nulo enquanto não lida |

O envio por e-mail entra depois reaproveitando esta mesma tabela — o registro já existe,
só falta o disparo.

### 4.7 Registro de auditoria

Toda ação relevante vira uma linha. **A tabela é somente inserção** — não existe caminho no
sistema para editar nem apagar registro de auditoria, nem para o superadmin.

| Campo | Conteúdo |
|---|---|
| `ator_id` | Quem executou |
| `ator_papel` | Papel no momento da ação |
| `em_nome_de_id` | Preenchido quando o admin agiu via "entrar como" (D13) |
| `acao` | Verbo canônico: `atividade.publicada`, `senha.redefinicao_disparada`... |
| `entidade` / `entidade_id` | O que foi afetado |
| `antes` / `depois` | JSON com o estado, só nos campos que mudaram |
| `ip`, `user_agent` | Origem |
| `ocorrido_em` | Quando |

**O que é auditado:** tudo que muda dados ou concede acesso — login, falha de login,
criação e mudança de estado de atividade, inscrição, aprovação e recusa, check-in,
validação de presença, emissão e revogação de certificado, edição de perfil, e **todas as
ações do superadmin**.

> **O admin é auditado como qualquer um.** Um log em que o administrador pode se apagar é
> teatro. Como ele tem poder de escrita amplo, o registro das ações *dele* é justamente o
> mais importante.

---

## 5. Regras de visibilidade da vitrine

Decisão D7, isolada aqui porque é sutil.

```
A atividade aparece na vitrine pública quando:

    status ∈ { publicada, em_andamento }
              E
    data do evento >= hoje
```

**Ou seja:**

| Situação | Aparece? | Botão de inscrição |
|---|:---:|---|
| Publicada, com vaga, data futura | ✅ | "Inscrever-se" |
| Publicada, **lotada**, data futura | ✅ | "Vagas esgotadas" (desabilitado) |
| Acontecendo hoje | ✅ | "Inscrições encerradas" (desabilitado) |
| Data já passou | ❌ | — |
| Rascunho | ❌ | — |
| Cancelada | ❌ | — |

> A atividade lotada **continua em destaque**: serve de vitrine do que a ONG faz e mostra
> movimento na plataforma. Ela só desaparece quando o dia do evento termina.

---

## 6. Mapa de telas

Quatro zonas, uma aplicação só (D10). Cada zona tem identidade visual própria: o portal é
institucional, o app do aluno é leve e mobile-first, o painel da ONG é denso e orientado a
gestão, o console do admin é tabular e sóbrio.

```
┌─────────────────────────────────────────────────────────────────┐
│  PORTAL  (público)                                              │
│  T1 Início · T2 Como funciona · T3 Para estudantes              │
│  T4 Para ONGs · T5 ONGs parceiras · T6 Verificar certificado    │
│  T7 Entrar · T8 Criar conta                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ login único (D9)
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ APP ALUNO   │    │ PAINEL ONG   │    │ CONSOLE ADMIN   │
│             │    │              │    │                 │
│ E1 Painel   │    │ O1 Painel    │    │ A1 Visão geral  │
│ E2 Vitrine  │    │ O2 Atividades│    │ A2 Auditoria    │
│ E3 Detalhe  │    │ O3 Criar/edit│    │ A3 Usuários     │
│ E4 Inscrições│   │ O4 Gerenciar │    │ A4 Detalhe user │
│ E5 Check-in │    │ O5 Inscrições│    │ A5 ONGs         │
│ E6 Certific.│    │ O6 QR ao vivo│    │ A6 Atividades   │
│ E7 Perfil   │    │ O7 Presenças │    │ A7 Certificados │
│             │    │ O8 Perfil    │    │ A8 Sistema      │
└─────────────┘    └──────────────┘    └─────────────────┘
```

**Login único:** todos entram pela mesma tela (T7). O destino sai do papel — aluno vai para
E1, ONG para O1, admin para A1. Não existe URL de login separada para admin: expor
`/admin/login` só entrega ao atacante a informação de que existe um alvo ali.

## 7. Detalhe das telas

Cada botão traz: **quando aparece** e **o que faz**.

---

### T1 — Início do portal

**Para quem:** visitante · **Rota:** `/`

A cara pública da plataforma. Explica a proposta e converte em cadastro. Usuário logado é
levado direto ao painel do seu perfil.

**Seções:** proposta em uma frase · como funciona em 4 passos · para quem serve (três
públicos) · ONGs parceiras · impacto em números · chamada final.

| Botão | Quando aparece | Ação |
|---|---|---|
| Sou estudante | sempre | Vai para T8 com o perfil pré-selecionado |
| Sou ONG | sempre | Vai para T8 com o perfil pré-selecionado |
| Entrar | sempre | Vai para T7 |
| Verificar certificado | sempre | Vai para T6 |
| Como funciona | sempre | Vai para T2 |

> **Números da vitrine saem de dados reais ou não existem.** Contagem ilustrativa fixa no
> código vira constrangimento na hora que alguém perguntar.

---

### T2 — Como funciona

**Rota:** `/como-funciona`

A jornada completa, do anúncio ao certificado verificado, com a explicação do QR dinâmico e
da assinatura. É a página que sustenta a conversa técnica sem exigir login.

| Botão | Quando aparece | Ação |
|---|---|---|
| Criar conta | visitante | Vai para T8 |
| Ver uma verificação de exemplo | sempre | Abre T6 com um código de demonstração |

---

### T3 — Para estudantes · T4 — Para ONGs

**Rotas:** `/para-estudantes` e `/para-ongs`

Uma página por público, cada uma respondendo "o que eu ganho com isso" e terminando em
cadastro com o perfil já escolhido.

| Botão | Quando aparece | Ação |
|---|---|---|
| Criar conta de estudante / de ONG | visitante | Vai para T8 pré-configurada |
| Ver atividades abertas | em T3 | Abre a vitrine pública |

---

### T5 — ONGs parceiras

**Rota:** `/ongs`

Vitrine das organizações ativas: logo, nome, cidade, quantas atividades já realizaram.
Serve de prova social e dá visibilidade a quem publica.

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver perfil | sempre | Abre o perfil público da ONG |
| Publicar minha ONG aqui | visitante | Vai para T8 como ONG |

---

### T6 — Verificar certificado

**Para quem:** verificador, **sem login** · **Rota:** `/verificar/:codigo`

**A tela mais importante do sistema.** É o destino do QR Code.

**Quatro desfechos, cada um com texto próprio.** Nenhum deles é tela de erro genérica — o
servidor devolve título e mensagem prontos, e a página exibe o que veio (RN-56).

| Desfecho | Título na tela | Cor |
|---|---|---|
| ✅ `valido` | "Certificado válido" | verde |
| ⚠️ `revogado` | "Este certificado foi revogado" | âmbar |
| ⛔ `adulterado` | "Este certificado não confere" | vermelho |
| ❌ `inexistente` | "Certificado não encontrado" | neutro |

Os três primeiros mostram também os selos *existe* · *não revogado* · *assinatura confere*,
e os dados do certificado. O texto exato de cada mensagem está em
[contrato-api.md](contrato-api.md), seção 9.

> **Adulterado é o desfecho mais importante da tela.** Ele significa que o registro foi
> alterado depois da emissão — e a mensagem precisa dizer isso com todas as letras, não
> apenas mostrar um selo vermelho. Quem está lendo é a coordenação decidindo se aceita ou
> não uma comprovação de horas.

| Botão | Quando aparece | Ação |
|---|---|---|
| Baixar PDF oficial | resultado válido | Baixa o PDF **da fonte**, não o arquivo recebido |
| Verificar outro código | sempre | Limpa e mostra o campo de código |

> O botão do PDF oficial é sutil e decisivo: o verificador para de depender do arquivo que
> lhe entregaram.

---

### T7 — Entrar

**Rota:** `/entrar` · **Login único para os três perfis** (D9)

| Campo | Regra |
|---|---|
| E-mail | obrigatório, formato válido |
| Senha | obrigatória |

| Botão | Quando aparece | Ação |
|---|---|---|
| Entrar | sempre | Autentica e leva ao painel conforme o papel |
| Criar conta | sempre | Vai para T8 |
| Esqueci minha senha | sempre | Inicia a redefinição |

**Erros:** e-mail inexistente e senha errada mostram **a mesma mensagem**. Excesso de
tentativas mostra o aviso de espera.

---

### T8 — Criar conta

**Rota:** `/criar-conta`

| Campo | Regra |
|---|---|
| Tipo de conta | Estudante ou ONG — **escolha explícita**. Admin não aparece aqui (D11) |
| Nome | 2 a 120 caracteres |
| E-mail | válido e ainda não cadastrado |
| Senha | mínimo 8 caracteres, com indicador de força |

| Botão | Quando aparece | Ação |
|---|---|---|
| Criar conta | sempre | Cria, autentica e leva ao painel |
| Já tenho conta | sempre | Vai para T7 |

---

### E1 — Painel do estudante

**Rota:** `/painel`

| Indicador | Cálculo |
|---|---|
| Horas validadas | Soma das horas dos certificados |
| Certificados | Quantidade emitida |
| Inscrições ativas | `pendente` + `confirmada` |

**Destaque contextual** — o painel mostra a ação mais urgente:

| Situação | O que aparece |
|---|---|
| Tem atividade acontecendo agora | **"Fazer check-in"** em destaque → E5 |
| Tem inscrição confirmada para hoje | Lembrete do horário e local |
| Tem certificado novo | "Você tem 1 certificado novo" → E6 |
| Nada disso | Convite para buscar atividades → E2 |

| Botão | Quando aparece | Ação |
|---|---|---|
| Fazer check-in | há atividade `em_andamento` com inscrição confirmada | Abre E5 |
| Buscar atividades | sempre | Vai para E2 |
| Minhas inscrições | sempre | Vai para E4 |
| Meus certificados | sempre | Vai para E6 |

---

### E2 — Vitrine de atividades

**Rota:** `/atividades`

Aplica as regras da seção 5. Ordenação: data mais próxima primeiro.

**Filtros:** busca por texto (título, local, ONG) · cidade · faixa de carga horária ·
"apenas com vaga" (desligado por padrão — as lotadas aparecem, D7)

**Cada cartão mostra:** título, ONG, data e hora, local, carga horária, vagas restantes, e
selo de "Aprovação necessária" quando for o caso.

| Botão no cartão | Quando aparece | Ação |
|---|---|---|
| Inscrever-se | há vaga e o aluno não está inscrito | Inscreve. Se exigir aprovação, avisa que ficará pendente |
| Vagas esgotadas | lotada | *Desabilitado* |
| Inscrições encerradas | `em_andamento` | *Desabilitado* |
| Aguardando aprovação | inscrição `pendente` | *Desabilitado*, informativo |
| Cancelar inscrição | inscrição ativa e o evento não começou | Pede confirmação e cancela |
| Ver detalhes | sempre | Abre E3 |

**Vazio:** "Nenhuma atividade disponível no momento" · **Busca sem resultado:** sugere
limpar os filtros.

---

### E3 — Detalhe da atividade

**Rota:** `/atividades/:id`

Descrição completa, dados do evento, ONG responsável (com link ao perfil público) e vagas.

**Mostra apenas a contagem de inscritos** — "12 pessoas inscritas" — nunca os nomes (D21).
Expor nome, curso e instituição de terceiros a qualquer colega seria vazar dado de quem não
consentiu. A ONG continua vendo a lista completa em `O5`, porque precisa dela para decidir.

Mesmos botões do cartão em E2, mais:

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver perfil da ONG | sempre | Abre o perfil público |
| Como chegar | há local definido | Abre o mapa |
| Compartilhar | sempre | Copia o link |

---

### E4 — Minhas inscrições

**Rota:** `/minhas-inscricoes`

Agrupadas em **Próximas** · **Aguardando aprovação** · **Histórico**.

| Estado | Selo |
|---|---|
| `pendente` | Aguardando aprovação (âmbar) |
| `confirmada` | Confirmada (verde) |
| `presente` | Presença confirmada (verde escuro) |
| `ausente` | Ausente (cinza) |
| `recusada` | Não aprovada (vermelho suave) — **sem motivo** (D8) |
| `cancelada` | Cancelada por você (cinza) |

| Botão | Quando aparece | Ação |
|---|---|---|
| Cancelar inscrição | `pendente` ou `confirmada`, evento não começou | Confirma e cancela |
| Fazer check-in | atividade `em_andamento` | Abre E5 |
| Ver certificado | `presente` com certificado | Vai para E6 |
| Ver atividade | sempre | Abre E3 |

---

### E5 — Check-in ⭐ *nova*

**Rota:** `/check-in` · **Só acessível** com atividade `em_andamento`

Abre a câmera e lê o QR que a ONG exibe (O6).

**Fluxo:** câmera abre → aluno aponta para o QR → lê o token → envia ao servidor →
resposta em tela cheia.

| Resultado | Mensagem |
|---|---|
| ✅ Sucesso | "Check-in registrado!" com horário |
| ⏱️ Token expirado | "Este código já venceu. Aponte de novo para a tela" |
| 🔁 Já fez check-in | "Você já registrou presença nesta atividade" |
| ❌ QR de outra atividade | "Este código é de outra atividade" |
| 📍 Longe demais | "Você precisa estar no local do evento" *(se geolocalização ativa)* |

| Botão | Quando aparece | Ação |
|---|---|---|
| Tentar de novo | após erro | Reabre a câmera |
| Voltar ao painel | após sucesso | Vai para E1 |
| Sem câmera? | sempre | Mostra campo para digitar o código manualmente |

> **Token expirado é o caso comum, não erro.** O QR muda a cada ~30 s (é essa a proteção).
> A mensagem precisa ser tranquila e convidar a tentar de novo, sem parecer falha.

---

### E6 — Meus certificados

**Rota:** `/meus-certificados`

| Botão | Quando aparece | Ação |
|---|---|---|
| Baixar PDF | sempre | Baixa o certificado |
| Copiar código | sempre | Copia o código de verificação |
| Ver verificação | sempre | Abre P4 — o aluno vê o que a coordenação verá |
| Compartilhar link | sempre | Copia a URL de verificação |

**Vazio:** explica que o certificado nasce da presença confirmada e leva para E2.

---

### E7 — Meu perfil

**Rota:** `/meu-perfil`

Dados pessoais, acadêmicos (instituição, curso), contato e foto.

| Botão | Quando aparece | Ação |
|---|---|---|
| Salvar | há alteração | Grava |
| Trocar foto | sempre | Abre o seletor (imagem, máx 2 MB) |
| Remover foto | há foto | Remove |
| Ver meu perfil público | sempre | Mostra como os outros veem |
| Sair da conta | sempre | Encerra a sessão |

---

### O1 — Painel da ONG

**Rota:** `/ong`

| Indicador | Cálculo |
|---|---|
| Atividades publicadas | `publicada` + `em_andamento` |
| Voluntários engajados | Inscrições confirmadas |
| Certificados emitidos | Total |

**Destaque contextual:**

| Situação | O que aparece |
|---|---|
| Atividade acontecendo agora | **"Abrir painel de check-in"** → O6 |
| Atividade aguardando validação | **"Validar presenças"** → O7 |
| Inscrições pendentes | "N pessoas aguardando aprovação" → O5 |
| Rascunho parado | "Você tem 1 rascunho não publicado" |

| Botão | Quando aparece | Ação |
|---|---|---|
| Criar atividade | sempre | Abre O3 |
| Abrir check-in | há atividade `em_andamento` | Abre O6 |
| Validar presenças | há atividade `aguardando_validacao` | Abre O7 |
| Minhas atividades | sempre | Abre O2 |

---

### O2 — Minhas atividades

**Rota:** `/ong/atividades`

Abas: **Rascunhos** · **Publicadas** · **Acontecendo** · **A validar** · **Finalizadas** ·
**Canceladas**

| Botão no cartão | Quando aparece | Ação |
|---|---|---|
| Publicar | `rascunho` | Valida e publica |
| Editar | `rascunho` ou `publicada` | Abre O3 (com as travas da RN-12) |
| Excluir | `rascunho` | Remove definitivamente |
| Cancelar atividade | `publicada` | Confirma, cancela e avisa os inscritos |
| Ver inscrições | tem inscritos | Abre O5 |
| Abrir check-in | `em_andamento` | Abre O6 |
| Validar presenças | `aguardando_validacao` | Abre O7 |
| Gerenciar | sempre | Abre O4 |

---

### O3 — Criar / editar atividade

**Rota:** `/ong/atividades/nova` e `/ong/atividades/:id/editar`

| Campo | Regra |
|---|---|
| Título | 1 a 40 caracteres |
| Descrição | 1 a 1500 |
| Local | 1 a 50 |
| Data | não pode ser no passado. **Um único dia** (D17) |
| Início / término | término depois do início |
| Carga horária | **sugerida pelo horário** (08:00–12:00 → 4h), editável para descontar intervalo (D18) |
| Vagas | mínimo e máximo; máximo ≥ mínimo |
| **Exigir aprovação** | interruptor (D1) — padrão desligado |

| Botão | Quando aparece | Ação |
|---|---|---|
| Salvar rascunho | criando ou em `rascunho` | Grava sem publicar |
| Publicar | formulário válido | Valida tudo e publica |
| Salvar alterações | editando publicada | Grava (com as travas) |
| Pré-visualizar | sempre | Mostra como o aluno verá |
| Descartar | criando | Confirma e sai sem salvar |

> **Edição com inscritos:** só as vagas mudam. Os demais campos aparecem **bloqueados, com
> explicação visível** — "Não pode ser alterado: já há 5 pessoas inscritas". O sistema
> atual ignora essas alterações em silêncio, o que é pior que bloquear.

---

### O4 — Gerenciar atividade

**Rota:** `/ong/atividades/:id`

Visão completa: dados, inscritos, check-ins e certificados emitidos. Concentra as ações do
ciclo de vida conforme o estado.

| Botão | Quando aparece | Ação |
|---|---|---|
| Publicar | `rascunho` | Publica |
| Editar | `rascunho`, `publicada` | Abre O3 |
| Cancelar atividade | `publicada` | Confirma, cancela e avisa os inscritos |
| Ver inscrições | tem inscritos | Abre O5 |
| Abrir check-in | `em_andamento` | Abre O6 |
| Validar presenças | `aguardando_validacao` | Abre O7 |
| Ver certificados | `finalizada` | Lista os emitidos |
| Excluir | `rascunho` | Remove |

> **A exclusão desaparece assim que a atividade sai de rascunho.** Atividade finalizada
> nunca é excluída — apagá-la destruiria certificados já entregues.

---

### O5 — Inscrições

**Rota:** `/ong/atividades/:id/inscricoes`

Duas seções: **Aguardando aprovação** (só se a atividade exigir) e **Confirmadas**.

Cada linha mostra nome, curso, instituição e link ao perfil público do aluno.

| Botão | Quando aparece | Ação |
|---|---|---|
| Aprovar | inscrição `pendente` | Confirma a vaga |
| Recusar | inscrição `pendente` | Recusa **sem pedir motivo** (D8) |
| Aprovar todas | há mais de uma pendente | Confirma em bloco |
| Ver perfil | sempre | Abre o perfil público do aluno |
| Exportar lista | tem inscritos | Baixa CSV *(v2)* |

---

### O6 — Painel de check-in ⭐ *nova*

**Rota:** `/ong/atividades/:id/check-in` · **Só em** `em_andamento`

**A tela que a ONG projeta ou mostra no celular durante o evento.**

```
┌─────────────────────────────────────┐
│   Mutirão de limpeza da praça       │
│                                     │
│      ███████████████████            │
│      ██ ▄▄▄▄▄ █▀█ ▄▄▄▄▄ ██          │  ← muda a cada 30 s
│      ██ █   █ █▄▀ █   █ ██          │
│      ██ █▄▄▄█ █▀▄ █▄▄▄█ ██          │
│      ███████████████████            │
│                                     │
│      Renova em 12s  ▓▓▓▓▓▓░░░░      │
│                                     │
│   ✓ 14 de 20 fizeram check-in       │
│                                     │
│   Maria Silva          há 2 min     │
│   João Souza           há 5 min     │
│   ...                               │
└─────────────────────────────────────┘
```

O QR **rotaciona sozinho** e a lista de quem chegou atualiza em tempo real. É o que impede
o print no WhatsApp: quando o colega recebe, o código já venceu.

| Botão | Quando aparece | Ação |
|---|---|---|
| Tela cheia | sempre | Amplia o QR para projeção |
| Pausar rotação | sempre | Congela por 60 s (problema de leitura) |
| Adicionar manualmente | sempre | Registra quem está sem celular |
| Encerrar check-in | sempre | Fecha a janela e vai para O7 |

> **"Adicionar manualmente" é indispensável.** Vai haver aluno sem celular, sem bateria ou
> sem internet. Sem essa saída, a tecnologia atrapalha quem ela deveria servir. A ação fica
> registrada como entrada manual, distinta do check-in por QR.

---

### O7 — Validar presenças

**Rota:** `/ong/atividades/:id/presencas` · **Só em** `aguardando_validacao`

A ONG revisa as evidências e decide. Chega **pré-preenchida**: quem fez check-in vem
marcado como presente.

| Coluna | Conteúdo |
|---|---|
| Aluno | Nome e curso |
| Check-in | Horário, ou "não registrou" |
| Origem | QR ou manual |
| Presença | Alternador presente / ausente |

| Botão | Quando aparece | Ação |
|---|---|---|
| Confirmar e emitir certificados | nenhuma pendência | Finaliza e emite |
| Marcar todos os check-ins como presentes | há check-ins | Preenche em bloco |
| Marcar restantes como ausentes | há sem decisão | Preenche o resto |
| Voltar depois | sempre | Salva sem finalizar |

**Trava:** não finaliza com aluno sem decisão. O botão fica desabilitado com o aviso
"3 participantes ainda sem definição".

**Confirmação:** "Serão emitidos 14 certificados de 4 horas. **Esta ação não pode ser
desfeita.**"

---

### O8 — Perfil da ONG

**Rota:** `/ong/perfil`

Nome, CNPJ, descrição, contato, endereço, redes e logo.

| Botão | Quando aparece | Ação |
|---|---|---|
| Salvar | há alteração | Grava |
| Trocar logo | sempre | Abre o seletor |
| Ver perfil público | sempre | Mostra como os alunos veem |
| Sair da conta | sempre | Encerra a sessão |

---

## 7b. Console do superadmin

Zona visual própria: tabular, densa, sóbria. Nada de ilustração — quem usa está
investigando um problema.

**Tarja permanente no topo:** `MODO ADMINISTRADOR — todas as suas ações são registradas`.
Não é enfeite: lembra o operador de que ele também é auditado.

---

### A1 — Visão geral

**Rota:** `/admin`

| Indicador | Conteúdo |
|---|---|
| Contas | Total, por papel, novas na semana |
| Atividades | Por estado |
| Certificados | Emitidos, revogados |
| Check-ins | Últimas 24h |
| Saúde | Banco, fila de e-mail, último erro |

**Alertas** que exigem atenção: atividade parada em `aguardando_validacao` há mais de 7
dias · pico de falha de login · certificado com assinatura inválida · ONG sem CNPJ.

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver auditoria | sempre | Abre A2 |
| Investigar alerta | há alerta | Abre a listagem já filtrada |

---

### A2 — Auditoria

**Rota:** `/admin/auditoria`

O registro completo de tudo (seção 4.6). **Somente leitura — não existe botão de editar nem
de apagar.**

**Filtros:** período · ator · papel · ação · entidade · IP · só ações de admin ·
só ações via "entrar como"

Cada linha expande e mostra o `antes`/`depois` em JSON.

| Botão | Quando aparece | Ação |
|---|---|---|
| Exportar CSV | há resultado | Baixa o recorte filtrado |
| Ver o ator | sempre | Abre A4 |
| Ver a entidade | sempre | Abre a atividade, inscrição ou certificado |

---

### A3 — Usuários

**Rota:** `/admin/usuarios`

Tabela de todas as contas: nome, e-mail, papel, situação, criada em, último acesso.

**Filtros:** papel · situação · texto · sem acesso há X dias

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver detalhe | sempre | Abre A4 |
| Suspender | conta ativa | Bloqueia o acesso; confirma e audita |
| Reativar | conta suspensa | Restaura o acesso |
| Criar administrador | sempre | Cria conta `superadmin`; **exige a senha do próprio admin** |

---

### A4 — Detalhe do usuário

**Rota:** `/admin/usuarios/:id`

Perfil completo, sessões ativas, histórico de atividades e inscrições, e a auditoria
filtrada por aquele usuário.

| Botão | Quando aparece | Ação |
|---|---|---|
| **Redefinir senha** | sempre | Envia o link de redefinição. **O admin não vê nem define a senha** (D12) |
| **Entrar como** | conta ativa, não admin | Abre a sessão espelho somente leitura (D13) |
| Encerrar sessões | há sessão ativa | Revoga todos os refresh tokens da pessoa |
| Suspender / Reativar | conforme situação | Alterna e audita |
| Editar dados de contato | sempre | Corrige e-mail ou telefone errado |
| Ver auditoria deste usuário | sempre | Abre A2 filtrada |

> **Por que não existe "definir senha":** um admin capaz de definir a senha de alguém é um
> admin capaz de se passar por essa pessoa — e o log registraria as ações como se fossem
> dela. Disparando a redefinição, o problema do usuário é resolvido e ninguém perde a
> capacidade de provar quem fez o quê.

---

### A4b — Modo "entrar como"

Não é tela: é um **estado da sessão** que atravessa todo o sistema.

```
┌───────────────────────────────────────────────────────────┐
│ 👁  Você está vendo como Maria Silva (aluna) · SOMENTE     │
│    LEITURA · registrado na auditoria      [ Sair do modo ] │
└───────────────────────────────────────────────────────────┘
```

**Regras:**

- **Somente leitura.** Todo botão de ação fica desabilitado; a API recusa qualquer escrita
- A tarja é fixa e não pode ser fechada
- A sessão espelho **expira em 30 minutos** e não renova
- Cada tela visitada gera registro com `em_nome_de` preenchido
- **Não funciona sobre outro superadmin** — admin não observa admin

---

### A5 — ONGs

**Rota:** `/admin/ongs`

Nome, CNPJ, cidade, atividades publicadas, voluntários atendidos, certificados emitidos,
data de entrada.

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver detalhe | sempre | Abre A4 da conta |
| Ver atividades | tem atividade | Abre A6 filtrada |
| Marcar como verificada | não verificada | Concede o selo de ONG verificada |
| Remover verificação | verificada | Retira o selo |
| Suspender | ativa | Bloqueia; as atividades saem da vitrine |

---

### A6 — Atividades

**Rota:** `/admin/atividades`

Todas as atividades de todas as ONGs, com filtro por estado, ONG, período e cidade.

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver detalhe | sempre | Abre a atividade em modo administrativo |
| **Editar** | qualquer estado editável | Corrige dados. Fica marcada como *editada pela administração* |
| Cancelar atividade | `publicada` ou `em_andamento` | Cancela e avisa os inscritos |
| Forçar validação | `aguardando_validacao` há muito tempo | Destrava a ONG inerte, com confirmação reforçada |
| Ver inscrições | tem inscritos | Lista com os check-ins |

> **A edição administrativa é visível.** A atividade passa a exibir "editada pela
> administração em <data>" para a ONG e para os inscritos. Correção silenciosa em dado de
> terceiro é indefensável.

---

### A7 — Certificados

**Rota:** `/admin/certificados`

Busca por código, aluno, ONG ou atividade. Mostra a situação da assinatura de cada um.

| Botão | Quando aparece | Ação |
|---|---|---|
| Ver verificação pública | sempre | Abre T6 — o admin vê o que o verificador vê |
| **Revogar** | certificado válido | Invalida, **exigindo motivo**. O registro permanece (RN-25) |
| Reverter revogação | revogado | Restaura, com auditoria |
| Reconferir assinatura | sempre | Recalcula e compara |

> **Não existe botão de emitir** (D14). Certificado nasce de presença confirmada em
> atividade real, e de mais nada. Um certificado criado à mão pelo admin teria assinatura
> válida sem lastro nenhum — e derrubaria a história anti-fraude inteira.
>
> Note o contraste com a revogação, que **exige motivo**, ao contrário da recusa de
> inscrição (D8): recusar afeta uma pessoa; revogar desfaz um documento que já circulou.

---

### A8 — Sistema

**Rota:** `/admin/sistema`

| Seção | Conteúdo |
|---|---|
| Chave de assinatura | Impressão digital da chave pública, data de criação |
| Parâmetros | Duração do token de check-in, do access token, limites de upload |
| Integridade | Executa a verificação de assinatura em lote e reporta divergências |
| Manutenção | Limpeza de refresh tokens expirados, de uploads órfãos |

| Botão | Quando aparece | Ação |
|---|---|---|
| Verificar todos os certificados | sempre | Varre a base e lista os que falharem |
| Limpar tokens expirados | sempre | Remove o que já venceu |
| Baixar chave pública | sempre | Entrega o `.pem` para auditoria externa |

> **Rotação da chave de assinatura não é botão de tela.** Trocar a chave invalidaria a
> verificação de todos os certificados já emitidos. Se um dia for necessário, é procedimento
> com assinatura em duas chaves durante a transição — decisão de engenharia, não clique.

---

## 8. Regras de negócio

| ID | Regra |
|---|---|
| **RN-01** | Um aluno não se inscreve duas vezes na mesma atividade enquanto tiver inscrição ativa |
| **RN-02** | Uma inscrição gera no máximo um certificado |
| **RN-03** | A atividade não é finalizada com participante sem decisão de presença |
| **RN-04** | Só inscrição `presente` gera certificado |
| **RN-05** | A data da atividade não pode ser no passado, ao criar nem ao editar |
| **RN-06** | O horário de término deve ser posterior ao de início |
| **RN-07** | A carga horária é um inteiro maior que zero |
| **RN-08** | O máximo de vagas não pode ser menor que o mínimo |
| **RN-09** | Não é possível se inscrever em atividade lotada |
| **RN-10** | Só a atividade `publicada` aceita inscrição |
| **RN-11** | Só a ONG criadora edita, publica, cancela, valida ou exclui a atividade |
| **RN-12** | Com inscritos, só as vagas podem ser alteradas — os demais campos ficam bloqueados na interface |
| **RN-13** | O máximo de vagas não pode ser reduzido abaixo do número de inscritos |
| **RN-14** | Presença atribui a carga horária da atividade; ausência atribui zero |
| **RN-15** | Atividade sem carga horária não pode ser finalizada |
| **RN-16** | O total de horas do aluno é a soma dos certificados |
| **RN-17** | O login não revela se um e-mail está cadastrado |
| **RN-18** | **A atividade finalizada não pode ser excluída** — só rascunho é removível |
| **RN-19** | Vaga é ocupada por inscrição `pendente` ou `confirmada`; cancelar ou recusar devolve |
| **RN-20** | O aluno cancela a inscrição até o início do evento; depois, não |
| **RN-21** | O check-in só é aceito com a atividade `em_andamento` |
| **RN-22** | Cada token de check-in vale uma vez e expira em ~30 segundos |
| **RN-23** | O check-in não define a presença sozinho — a ONG confirma |
| **RN-24** | Todo certificado é assinado na emissão; a verificação confere a assinatura |
| **RN-25** | O certificado é revogável sem ser apagado |
| **RN-26** | A recusa de inscrição não registra nem exibe motivo |
| **RN-27** | Conta `superadmin` não é criada por cadastro público — só por comando no servidor ou por outro admin |
| **RN-28** | O superadmin **não define nem visualiza senha** de ninguém; só dispara redefinição |
| **RN-29** | O modo "entrar como" é **somente leitura** — a API recusa qualquer escrita nele |
| **RN-30** | O modo "entrar como" não se aplica sobre outro superadmin |
| **RN-31** | A sessão espelho expira em 30 minutos e não é renovada |
| **RN-32** | Toda ação do superadmin é auditada, inclusive leitura de dado sensível |
| **RN-33** | O registro de auditoria é **somente inserção** — nenhum perfil edita ou apaga |
| **RN-34** | O superadmin **não emite certificado**; só revoga, e a revogação exige motivo |
| **RN-35** | Atividade editada pelo admin exibe o aviso de edição administrativa à ONG e aos inscritos |
| **RN-36** | Suspender uma ONG remove suas atividades da vitrine, sem apagar histórico |
| **RN-37** | Criar outro administrador exige que o admin reconfirme a própria senha |
| **RN-38** | Redefinir senha **revoga todas as sessões ativas** daquele usuário |
| **RN-39** | Falha em operação de escrita **não é repetida automaticamente** pelo cliente |
| **RN-40** | Suspender conta **não apaga nada** — histórico, certificados e auditoria permanecem |
| **RN-41** | A emissão de certificados ao finalizar é **atômica**: falha em um reverte todos |
| **RN-42** | Tentativa de login malsucedida é registrada na auditoria |
| **RN-43** | Check-in manual grava origem distinta do check-in por QR |
| **RN-44** | O sistema mantém sempre **ao menos um superadmin ativo** |
| **RN-45** | O aluno precisa ter nome completo, instituição e curso preenchidos antes da **primeira** inscrição |
| **RN-46** | Cada aluno tem no máximo **5 inscrições ativas** (`pendente` + `confirmada` ainda não realizadas) |
| **RN-47** | O aluno vê apenas a **contagem** de inscritos; nomes só para a ONG dona |
| **RN-48** | A carga horária é **sugerida pela diferença entre início e término**, editável pela ONG, sempre maior que zero |
| **RN-49** | Uma atividade ocupa **um único dia** |
| **RN-50** | O certificado usa o **nome completo**; na falta dele, o nome de cadastro |
| **RN-51** | Suspender ONG **cancela as atividades futuras** e preserva as finalizadas e seus certificados |
| **RN-52** | A verificação pública aceita **60 consultas por minuto por IP** |
| **RN-53** | Todo horário é interpretado em `America/Sao_Paulo` e gravado em UTC |
| **RN-54** | `em_andamento` e `aguardando_validacao` são **derivados do relógio**, não gravados |
| **RN-55** | Uma atividade pertence a **uma única ONG** |
| **RN-56** | A verificação de certificado **nunca exibe erro genérico** — cada um dos quatro desfechos tem título e mensagem próprios, vindos do servidor |

### Por que estas sete existem

Cada uma nasceu de um modo de falha concreto, não de preferência de estilo.

**RN-38 — sessões caem junto com a senha.** Quem redefine a senha em geral está reagindo a
uma suspeita de invasão. Se a sessão do invasor continuar viva, a troca de senha não
resolveu nada — ele segue dentro. *(FA-04)*

**RN-39 — escrita não se repete sozinha.** Um "finalizar atividade" reenviado após timeout
poderia emitir a segunda leva de certificados. Leitura pode ser repetida à vontade; escrita
exige que a pessoa decida. *(FX-03)*

**RN-40 — suspender preserva.** Uma ONG suspensa por má conduta continua tendo alunos que
participaram de verdade e ganharam o certificado. Apagar destruiria comprovação de quem não
tem culpa nenhuma, e ainda apagaria a evidência necessária para investigar a própria ONG.
*(FS-05)*

**RN-41 — tudo ou nada na emissão.** Se a assinatura falhar no oitavo de catorze
certificados, metade da turma sai com documento e metade não, sem ninguém saber quem. A
transação inteira volta atrás e a ONG tenta de novo. *(FO-09 E5)*

**RN-42 — falha de login também é registro.** Sem registrar o que deu errado, não há como
detectar ataque de força bruta depois. O rate limit barra o excesso; a auditoria é o que
permite investigar. *(FA-02)*

**RN-43 — QR e manual não se confundem.** Distinguir a origem mantém a rastreabilidade: dá
para ver quantas presenças tiveram evidência automática e quantas dependeram da palavra da
ONG. Sem isso, a entrada manual contaminaria a força da camada de QR. *(FO-08)*

**RN-44 — nunca zero admin.** Suspender ou remover o último administrador deixaria o
sistema sem quem o opere, sem caminho de recuperação pela interface. *(FS-05 E2)*

---

## 9. Segurança do certificado

Três camadas, da mais fraca à mais forte.

### Camada 1 — Código de verificação *(já existe)*

Cada certificado tem um código público. A verificação consulta a base. **Derrota:** PDF
editado no computador.

### Camada 2 — Check-in por QR dinâmico *(D3)*

```
ONG abre O6
    │
    ├─► gera token assinado: { atividade, janela de tempo, aleatório }
    │   expira em ~30 s e rotaciona
    │
    ▼
QR na tela  ──escaneado──►  aluno envia o token
                                  │
                                  ▼
                    servidor confere: assinatura ok?
                                     dentro da janela?
                                     ainda não usado?
                                     inscrição confirmada?
                                  │
                                  ▼
                            check-in registrado
```

**Derrota:** o print enviado ao colega que não foi. Quando ele recebe, o código já venceu.

### Camada 3 — Assinatura do certificado *(D4)*

Na emissão, o servidor assina os dados canônicos com **Ed25519**:

```
assinatura = Ed25519(chave_privada,
    ["MHC1", codigo, aluno, organizacao, atividade, horas, data_atividade, emitido_em])
```

O texto assinado é uma lista JSON e cobre **todo campo que a verificação pública exibe**.
Deixar a organização ou a data de fora permitiria trocar o nome da ONG direto no banco sem
quebrar a assinatura. A versão na frente (`MHC1`) permite mudar o formato no futuro sem
invalidar o que já foi emitido.

A chave privada vive **em variável de ambiente** — nunca no banco, nunca no repositório.
A pública pode ser divulgada para auditoria independente.

**Derrota:** quem consegue escrever no banco. Sem a chave privada, não produz assinatura
válida, e a verificação denuncia com o selo de adulteração.

### Por que a verificação continua online

Colocar a assinatura dentro do QR permitiria conferência offline — mas **um QR assinado
vale para sempre**. Certificado emitido por engano continuaria passando, porque a
matemática segue correta. Não existe "desassinar".

Por isso a base é a autoridade final (permite revogação, RN-25) e a assinatura é a segunda
camada. O QR carrega só a URL: curto e fácil de ler.

---

## 10. Escopo

### Versão 1

Tudo descrito acima, incluindo **recuperação de senha** (D15) e **notificação dentro do
sistema** (D16) — ambas são pré-requisito de fluxos que já existem no desenho, não extras.

Uma exceção: a geolocalização no check-in fica **opcional e desligada** por padrão. A rotação do token já resolve o ataque principal, e GPS em ambiente
fechado gera falso negativo — o que puniria o aluno certo.

### Depois

- **Notificação por e-mail** — a v1 avisa dentro do sistema (D16); o e-mail reaproveita a
  mesma tabela
- Exportação de listas em CSV
- Categorias e áreas de atuação
- Avaliação mútua entre aluno e ONG
- Verificação offline com QR estendido
- Aplicativo nativo

### Fora do escopo do produto

- Perfil de coordenação ou painel institucional (D2)
- Administração e moderação de conteúdo
- Pagamento ou qualquer transação financeira

---

## 11. O que muda em relação ao sistema atual

| Área | Hoje | Alvo |
|---|---|---|
| Estados da atividade | 2 usados (`ativa`, `finalizada`) | 6 |
| Rascunho | não existe | ✅ |
| Aprovação de inscrição | não existe | ✅ opcional por atividade |
| Cancelamento pelo aluno | não existe | ✅ até o evento começar |
| Check-in | não existe | ✅ QR dinâmico |
| Presença | ONG marca na lista | ONG confirma a partir das evidências |
| Certificado | código na base | código + assinatura Ed25519 |
| Revogação | não existe | ✅ |
| Excluir atividade finalizada | permitido (destrói certificados) | **proibido** (RN-18) |
| Autorização na presença | **falha conhecida** | corrigida por RN-11 |
| Vitrine | filtrada no navegador | filtrada no servidor (seção 5) |
| Portal institucional | não existe (só landing) | ✅ 8 páginas públicas |
| Perfis autenticados | 2 | 3 (entra o superadmin) |
| Auditoria | não existe | ✅ registro somente inserção |
| Console administrativo | não existe | ✅ 8 telas |
| Suporte a usuário | nenhum caminho | redefinição de senha e "entrar como" somente leitura |
| Recuperação de senha | não existe | ✅ na v1 |
| Notificações | não existe | ✅ dentro do sistema na v1 |
| Carga horária | digitada livremente | sugerida pelo horário, ajustável |
| Perfil mínimo | não exigido | exigido antes da 1ª inscrição |
| Limite de inscrições | sem limite | 5 ativas por aluno |
| Lista de inscritos | visível a todos | só a contagem para o aluno |
| Fuso horário | implícito | `America/Sao_Paulo` explícito |
