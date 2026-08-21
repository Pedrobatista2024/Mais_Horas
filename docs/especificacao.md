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

O **Verificador** — coordenação de curso, faculdade, empregador — nunca cria conta. É para
ele que a verificação pública existe, e é o ator que justifica o projeto.

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

**Transições automáticas** (por tempo, não por clique):
- `publicada` → `em_andamento` quando chega a data e a hora de início
- `em_andamento` → `aguardando_validacao` quando passa a hora de término

### 4.2 Condições calculadas — não são estados

| Condição | Cálculo | Efeito na interface |
|---|---|---|
| **Lotada** | vagas ocupadas ≥ máximo | Botão de inscrição vira "Vagas esgotadas", desabilitado. **A atividade continua na vitrine** (D7) |
| **Vagas restantes** | máximo − ocupadas | Exibido no cartão: "3 vagas restantes" |
| **Já inscrito** | existe inscrição ativa do aluno | Botão vira "Cancelar inscrição" |

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

```
PÚBLICO                    ESTUDANTE                    ONG
────────                   ─────────                    ───
P1 Landing                 E1 Painel                    O1 Painel
P2 Entrar                  E2 Vitrine                   O2 Minhas atividades
P3 Criar conta             E3 Detalhe da atividade      O3 Criar/editar atividade
P4 Verificar certificado   E4 Minhas inscrições         O4 Gerenciar atividade
                           E5 Check-in (câmera)         O5 Inscrições
                           E6 Meus certificados         O6 Painel de check-in (QR)
                           E7 Meu perfil                O7 Validar presenças
                                                        O8 Perfil da ONG
```

19 telas. As duas em **negrito** abaixo são as novas em relação ao sistema atual:
**E5 (check-in do aluno)** e **O6 (QR rotativo da ONG)** — o coração da decisão D3.

---

## 7. Detalhe das telas

Cada botão traz: **quando aparece** e **o que faz**.

---

### P1 — Landing

**Para quem:** visitante · **Rota:** `/`

Explica a proposta e converte em cadastro. Usuário logado é redirecionado ao seu painel.

| Botão | Quando aparece | Ação |
|---|---|---|
| Sou estudante | sempre | Vai para P3 com perfil pré-selecionado |
| Sou ONG | sempre | Vai para P3 com perfil pré-selecionado |
| Entrar | sempre | Vai para P2 |
| Verificar certificado | sempre | Vai para P4 |

> Os números da vitrine ("+120 vagas") devem sair de dados reais ou não existir. Número
> ilustrativo na tela vira problema em apresentação.

---

### P2 — Entrar

**Para quem:** visitante · **Rota:** `/entrar`

| Campo | Regra |
|---|---|
| E-mail | obrigatório, formato válido |
| Senha | obrigatória |

| Botão | Quando aparece | Ação |
|---|---|---|
| Entrar | sempre | Autentica e leva ao painel do perfil |
| Criar conta | sempre | Vai para P3 |
| Esqueci minha senha | sempre | Inicia recuperação *(v2)* |

**Erros:** credencial inválida mostra **a mesma mensagem** para e-mail inexistente e senha
errada — "E-mail ou senha incorretos". Excesso de tentativas mostra o aviso de espera.

---

### P3 — Criar conta

**Para quem:** visitante · **Rota:** `/criar-conta`

| Campo | Regra |
|---|---|
| Tipo de conta | Estudante ou ONG — **escolha explícita, sem padrão silencioso** |
| Nome | 2 a 120 caracteres |
| E-mail | válido e ainda não cadastrado |
| Senha | mínimo 8 caracteres, com indicador de força |

| Botão | Quando aparece | Ação |
|---|---|---|
| Criar conta | sempre | Cria, autentica e leva ao painel |
| Já tenho conta | sempre | Vai para P2 |

---

### P4 — Verificar certificado

**Para quem:** verificador, **sem login** · **Rota:** `/verificar/:codigo`

**A tela mais importante do sistema.** É o destino do QR Code.

**Resultado — quatro desfechos possíveis:**

| Desfecho | O que mostra |
|---|---|
| ✅ **Válido** | Aluno, atividade, ONG, carga horária, data. Três selos: *existe*, *não revogado*, *assinatura confere* |
| ⚠️ **Revogado** | Os dados, com aviso destacado de que o certificado foi invalidado |
| ⛔ **Adulterado** | Registro existe mas a assinatura não confere — **alerta de fraude** |
| ❌ **Inexistente** | "Nenhum certificado com este código" |

| Botão | Quando aparece | Ação |
|---|---|---|
| Baixar PDF oficial | resultado válido | Baixa o PDF **da fonte**, não o arquivo recebido |
| Verificar outro código | sempre | Limpa e mostra o campo de código |

> O botão de baixar o PDF oficial é sutil e importante: o verificador para de depender do
> arquivo que lhe entregaram.

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

Descrição completa, dados do evento, ONG responsável (com link ao perfil público), vagas e
quem já se inscreveu.

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
| Data | não pode ser no passado |
| Início / término | término depois do início |
| Carga horária | inteiro maior que zero |
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
assinatura = Ed25519(chave_privada, "codigo|aluno|atividade|horas|emitido_em")
```

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

Tudo descrito acima, com uma exceção: a geolocalização no check-in fica **opcional e
desligada** por padrão. A rotação do token já resolve o ataque principal, e GPS em ambiente
fechado gera falso negativo — o que puniria o aluno certo.

### Depois

- Recuperação de senha
- Notificação por e-mail (inscrição aprovada, certificado emitido, atividade cancelada)
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
