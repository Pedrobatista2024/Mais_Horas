# Fluxos do Sistema — Mais Horas

Todo caminho que se pode percorrer no sistema: o que dá certo, o que varia e o que dá
errado. Complementa a [especificação funcional](especificacao.md), que define **o que
existe**; aqui está **como se usa**.

---

## Como ler

Cada fluxo segue a mesma estrutura:

| Seção | Conteúdo |
|---|---|
| **Ator** | Quem executa |
| **Pré-condições** | O que precisa ser verdade antes |
| **Gatilho** | O que inicia |
| **Caminho feliz** | A sequência quando tudo dá certo |
| **Alternativos** (`A1`, `A2`…) | Variações válidas, não são erro |
| **Exceções** (`E1`, `E2`…) | Erros, com a mensagem e o código |
| **Pós-condições** | O que ficou diferente no fim |
| **Auditoria** | O que foi registrado |

**Referências:** `RN-xx` são regras de negócio e `Dx` são decisões de produto, ambas em
[especificacao.md](especificacao.md). `T1`–`T8`, `E1`–`E7`, `O1`–`O8` e `A1`–`A8` são telas.

---

## Índice

| Grupo | Fluxos |
|---|---|
| **Acesso** | FA-01 a FA-05 |
| **Estudante** | FE-01 a FE-10 |
| **ONG** | FO-01 a FO-11 |
| **Verificador** | FV-01 a FV-02 |
| **Superadmin** | FS-01 a FS-11 |
| **Automáticos** | FT-01 a FT-04 |
| **Transversais** | FX-01 a FX-04 |

---

# Acesso

## FA-01 — Criar conta

**Ator:** visitante · **Gatilho:** clica em "Criar conta" no portal

**Caminho feliz**

1. Abre `T8`
2. Escolhe o tipo de conta: estudante ou ONG
3. Informa nome, e-mail e senha
4. Confirma
5. O sistema valida, cria a conta e inicia a sessão
6. Redireciona: estudante → `E1`, ONG → `O1`

**Alternativos**

- **A1** — Chegou por `T3`/`T4`: o tipo já vem pré-selecionado, mas continua trocável
- **A2** — Já tem conta: segue para `T7` (FA-02)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail já cadastrado | `409` — "Este e-mail já está em uso" |
| E2 | E-mail inválido | `400`, campo destacado |
| E3 | Senha com menos de 8 caracteres | `400`, com o medidor de força em vermelho |
| E4 | Nome com menos de 2 caracteres | `400`, campo destacado |
| E5 | Tipo de conta não escolhido | Bloqueado na interface, sem chamar a API |
| E6 | Mais de 20 tentativas em 15 min | `429` — "Muitas tentativas. Aguarde alguns minutos" |

**Pós-condições:** conta criada · sessão ativa · perfil vazio aguardando preenchimento

**Auditoria:** `conta.criada`

> Não existe opção de criar conta `superadmin` aqui (RN-27).

---

## FA-02 — Entrar

**Ator:** estudante, ONG ou superadmin · **Gatilho:** clica em "Entrar"

**Caminho feliz**

1. Abre `T7`
2. Informa e-mail e senha
3. O sistema autentica
4. Redireciona conforme o papel: `E1`, `O1` ou `A1`

**Alternativos**

- **A1** — Sessão anterior ainda válida: ao abrir o portal, é levado direto ao painel sem ver `T7`
- **A2** — Senha em formato antigo (bcrypt): entra normalmente e o hash é atualizado para Argon2id em silêncio
- **A3** — Esqueceu a senha: segue para FA-04

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail não cadastrado | `400` — "E-mail ou senha incorretos" |
| E2 | Senha errada | `400` — **mesma mensagem de E1** (RN-17) |
| E3 | Conta suspensa | `403` — "Esta conta está suspensa. Fale com o suporte" |
| E4 | Excesso de tentativas | `429` |

**Pós-condições:** access token em memória · refresh token no cookie `httpOnly`

**Auditoria:** `sessao.iniciada` no sucesso, `sessao.falha` nas exceções E1–E3 (RN-42) — o
registro de falha é o que permite detectar ataque de força bruta depois

---

## FA-03 — Renovar sessão

**Ator:** qualquer autenticado · **Gatilho:** access token expirou (15 min)

Fluxo automático, invisível ao usuário.

**Caminho feliz**

1. Uma requisição qualquer volta `401`
2. O cliente chama `POST /api/v1/auth/renovar`, enviando o cookie
3. O servidor valida, **rotaciona** o par e devolve o novo access
4. O cliente refaz a requisição original
5. O usuário não percebe nada

**Alternativos**

- **A1** — Várias requisições falham juntas: só um refresh sai; as demais aguardam a mesma promessa
- **A2** — Duas abas renovam ao mesmo tempo: dentro da janela de graça de 15s, ambas recebem par novo sem derrubar a sessão

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Cookie ausente | `401` → vai para `T7` |
| E2 | Refresh expirado (7 dias) | `401` — "Sua sessão expirou. Entre novamente" |
| E3 | Token já consumido, fora da janela | `401` + **revogação da família inteira** — tratado como roubo |
| E4 | Sessão revogada por admin (FS-06) | `401` → login novo |

**Auditoria:** `sessao.renovada` · `sessao.reuso_detectado` em E3

---

## FA-04 — Redefinir senha esquecida

**Ator:** qualquer usuário · **Gatilho:** clica em "Esqueci minha senha", ou o admin dispara (FS-03)

**Caminho feliz**

1. Informa o e-mail
2. O sistema **sempre** responde "Se este e-mail estiver cadastrado, enviaremos as instruções"
3. Existindo a conta, envia um link com token de uso único, válido por 1 hora
4. O usuário abre o link e define a nova senha
5. O sistema grava, **revoga todas as sessões** e leva para `T7`

**Alternativos**

- **A1** — Disparado pelo admin: idêntico, mas o registro marca quem disparou
- **A2** — Pede de novo: o token anterior é invalidado; só o último vale

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail não cadastrado | **Mesma resposta do passo 2** — não revela se existe |
| E2 | Token expirado | "Este link expirou. Solicite um novo" |
| E3 | Token já usado | Mesma mensagem de E2 |
| E4 | Nova senha fraca | `400`, com o medidor |

**Pós-condições:** senha nova em Argon2id · **todas as sessões antigas revogadas** (RN-38)

**Auditoria:** `senha.redefinicao_disparada` · `senha.redefinida`

> **RN-38.** Revogar as sessões no passo 5 é essencial: se a pessoa está redefinindo
> porque desconfia de invasão, deixar a sessão do invasor viva anularia a troca.

---

## FA-05 — Sair

**Ator:** qualquer autenticado · **Gatilho:** clica em "Sair da conta"

**Caminho feliz**

1. O cliente limpa o estado local **na hora** — a interface reage sem esperar
2. Em paralelo, chama `POST /api/v1/auth/sair`
3. O servidor revoga a família de refresh tokens e limpa o cookie
4. Vai para o portal

**Alternativos**

- **A1** — Servidor não responde: a sessão local morre do mesmo jeito; o refresh expira sozinho em 7 dias
- **A2** — Estava em "entrar como" (FS-04): sai apenas do modo espelho e volta ao console

**Auditoria:** `sessao.encerrada`

---

# Estudante

## FE-01 — Descobrir atividades

**Ator:** estudante · **Gatilho:** abre `E2`

**Caminho feliz**

1. O sistema lista as atividades visíveis (regra da seção 5 da especificação)
2. Ordena da data mais próxima para a mais distante
3. O aluno navega, filtra ou busca
4. Abre `E3` para ver detalhes

**Alternativos**

- **A1** — Busca por texto: casa com título, local e nome da ONG
- **A2** — Filtra por cidade, carga horária ou "apenas com vaga"
- **A3** — Atividade **lotada**: aparece normalmente, com o botão desabilitado (D7)
- **A4** — Atividade acontecendo hoje: aparece com "Inscrições encerradas"
- **A5** — Já inscrito: o cartão mostra o selo do estado e o botão de cancelar
- **A6** — Chegou a 5 inscrições ativas: os botões de inscrever desabilitam com a explicação (RN-46)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Nenhuma atividade disponível | Estado vazio: "Nenhuma atividade disponível no momento" |
| E2 | Busca sem resultado | "Nada encontrado para essa busca" + botão de limpar filtros |
| E3 | Falha de rede | Estado de erro com botão de tentar de novo |

---

## FE-02 — Inscrever-se (aprovação automática)

**Ator:** estudante · **Pré-condições:** atividade `publicada`, com vaga, sem exigir aprovação

**Caminho feliz**

1. Clica em "Inscrever-se" em `E2` ou `E3`
2. O sistema confere vaga e duplicidade
3. Cria a inscrição já como **`confirmada`**
4. Confirma na tela e o botão vira "Cancelar inscrição"
5. O contador de vagas restantes cai

**Alternativos**

- **A1** — Era a última vaga: a atividade passa a exibir "Vagas esgotadas" para os demais, mas **continua na vitrine** (D7)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Já inscrito | `400` — "Você já está inscrito nesta atividade" |
| E2 | Lotou entre a tela e o clique | `400` — "As vagas se esgotaram" + a tela recarrega |
| E3 | Atividade cancelada nesse intervalo | `400` — "Esta atividade foi cancelada" |
| E4 | Atividade já começou | `400` — "As inscrições estão encerradas" |
| E5 | Uma ONG tenta se inscrever | `403` |
| E6 | **Perfil incompleto** | Antes de chamar a API, a interface leva a `E7`: "Complete seu perfil para se inscrever" (RN-45) |
| E7 | **Já tem 5 inscrições ativas** | `400` — "Você já tem 5 inscrições ativas. Conclua ou cancele alguma" (RN-46) |

**Pós-condições:** inscrição `confirmada` · uma vaga ocupada (RN-19)

**Auditoria:** `inscricao.criada`

---

## FE-03 — Inscrever-se (com aprovação)

**Ator:** estudante · **Pré-condições:** atividade exige aprovação (D1)

**Caminho feliz**

1. O cartão exibe o selo "Aprovação necessária" — o aluno sabe antes de clicar
2. Clica em "Inscrever-se"
3. O sistema cria a inscrição como **`pendente`**
4. Avisa: "Inscrição enviada. A ONG vai avaliar seu pedido"
5. O botão vira "Aguardando aprovação", desabilitado
6. **A vaga já fica reservada** (RN-19)

**Alternativos**

- **A1** — A ONG aprova depois (FO-05): a inscrição vira `confirmada`
- **A2** — A ONG recusa (FO-06): vira `recusada`, sem motivo exibido (D8)
- **A3** — O aluno desiste antes da resposta: pode cancelar normalmente (FE-04)

**Exceções:** as mesmas de FE-02

**Pós-condições:** inscrição `pendente` · vaga reservada

**Auditoria:** `inscricao.criada`

> A vaga ser reservada já na pendência é decisão de projeto: sem isso, um aluno aprovado
> poderia descobrir que não há mais lugar — o que seria pior do que esperar.

---

## FE-04 — Cancelar inscrição

**Ator:** estudante · **Pré-condições:** inscrição `pendente` ou `confirmada`, evento não começou (D5)

**Caminho feliz**

1. Em `E2`, `E3` ou `E4`, clica em "Cancelar inscrição"
2. O sistema pede confirmação: "Deseja mesmo cancelar? A vaga será liberada"
3. Confirma
4. A inscrição vira `cancelada` e **a vaga volta** (RN-19)
5. O botão volta a ser "Inscrever-se"

**Alternativos**

- **A1** — Estava `pendente`: cancela igual, e some da fila de aprovação da ONG
- **A2** — Desiste de cancelar: nada acontece
- **A3** — Se inscreve de novo depois: permitido, se ainda houver vaga

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | O evento já começou | `400` — "A atividade já começou e não pode mais ser cancelada" (RN-20) |
| E2 | Já está `presente` ou `ausente` | `400` — mesma mensagem |
| E3 | Inscrição inexistente | `404` |

**Pós-condições:** inscrição `cancelada` · vaga devolvida

**Auditoria:** `inscricao.cancelada`

---

## FE-05 — Fazer check-in ⭐

**Ator:** estudante · **Pré-condições:** inscrição `confirmada` em atividade `em_andamento`

**Caminho feliz**

1. O painel `E1` mostra "Fazer check-in" em destaque
2. Abre `E5` e o navegador pede permissão de câmera
3. Aponta para o QR exibido pela ONG em `O6`
4. O app lê o token e envia ao servidor
5. O servidor confere: assinatura · janela de tempo · token não usado · inscrição confirmada
6. Registra o check-in
7. Tela cheia: "Check-in registrado!" com o horário
8. O nome do aluno aparece na lista ao vivo em `O6`

**Alternativos**

- **A1** — Sem câmera ou permissão negada: usa "Sem câmera?" e digita o código manualmente
- **A2** — Token venceu entre o escaneamento e o envio: mensagem tranquila para apontar de novo
- **A3** — Sem celular: a ONG registra por ele (FO-08)
- **A4** — Geolocalização ativa: o app envia as coordenadas junto

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Token expirado | "Este código já venceu. Aponte de novo para a tela" — **caso comum, não erro** |
| E2 | Token de outra atividade | "Este código é de outra atividade" |
| E3 | Já fez check-in | "Você já registrou presença nesta atividade" |
| E4 | Atividade não está `em_andamento` | `400` — "O check-in não está aberto" (RN-21) |
| E5 | Sem inscrição confirmada | `403` — "Você não está inscrito nesta atividade" |
| E6 | Token já usado por outra pessoa | `400` — tentativa de reuso, registrada |
| E7 | Fora do raio (se ativo) | "Você precisa estar no local do evento" |
| E8 | Sem internet | "Sem conexão. Tente de novo" com botão de repetir |

**Pós-condições:** check-in registrado · **a inscrição continua `confirmada`** — o check-in
é evidência, não decisão (RN-23)

**Auditoria:** `checkin.registrado` · `checkin.token_invalido` nas exceções

---

## FE-06 — Acompanhar inscrições

**Ator:** estudante · **Gatilho:** abre `E4`

**Caminho feliz**

1. Vê as inscrições em três grupos: **Próximas**, **Aguardando aprovação** e **Histórico**
2. Cada uma com seu selo de estado
3. Age conforme o caso: cancelar, fazer check-in ou ver certificado

**Alternativos**

- **A1** — Nenhuma inscrição: estado vazio convidando a buscar atividades
- **A2** — Inscrição `recusada`: mostra "Não aprovada", **sem motivo** (D8)
- **A3** — Inscrição `ausente`: mostra o estado; não gerou certificado

---

## FE-07 — Obter certificado

**Ator:** estudante · **Pré-condições:** inscrição `presente` em atividade `finalizada`

**Caminho feliz**

1. Abre `E6` e vê a lista
2. Cada item traz atividade, carga horária e código de verificação
3. Clica em "Baixar PDF"
4. O servidor gera o PDF com o QR e entrega

**Alternativos**

- **A1** — Copia só o código, sem baixar
- **A2** — "Ver verificação": abre `T6` e vê exatamente o que a coordenação verá
- **A3** — Compartilha o link de verificação

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Nenhum certificado | Estado vazio explicando que nasce da presença confirmada |
| E2 | Certificado revogado | Aparece com aviso; o PDF continua disponível, mas a verificação acusa |
| E3 | Falha ao gerar o PDF | "Não foi possível gerar o arquivo. Tente novamente" |

---

## FE-08 — Comprovar horas para a coordenação

**Ator:** estudante · **Gatilho:** precisa entregar a comprovação

**Caminho feliz**

1. Baixa o PDF em `E6`
2. Entrega impresso ou por e-mail
3. A coordenação escaneia o QR
4. Cai em `T6` e confirma na fonte (FV-01)

**Alternativos**

- **A1** — Sistema da faculdade só aceita código: o aluno copia e cola o código
- **A2** — Coordenação prefere o arquivo oficial: baixa direto de `T6`, sem confiar no que recebeu
- **A3** — Várias atividades: o aluno entrega um certificado por atividade

---

## FE-09 — Manter perfil

**Ator:** estudante · **Gatilho:** abre `E7`

**Caminho feliz**

1. Preenche dados pessoais, acadêmicos e contato
2. Opcionalmente envia foto
3. Salva

**Nome completo, instituição e curso são obrigatórios antes da primeira inscrição** (RN-45).
A interface destaca os três enquanto estiverem vazios, e é para cá que `FE-02 E6` traz o
aluno que tentou se inscrever sem tê-los.

**Alternativos**

- **A1** — Atualização parcial: só o que mudou é enviado
- **A2** — Troca de foto: a anterior é apagada do servidor
- **A3** — Sem foto: a interface usa as iniciais do nome

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Arquivo acima de 2 MB | `400` — "Arquivo muito grande (máx 2MB)" |
| E2 | Arquivo não é imagem | `400` — "Envie uma imagem" |
| E3 | Campo acima do limite | `400`, campo destacado |

**Auditoria:** `perfil.atualizado`

---

## FE-10 — Acompanhar notificações

**Ator:** estudante ou ONG · **Gatilho:** o sino do cabeçalho exibe contador de não lidas

Fluxo curto, mas necessário: sete pontos deste documento dizem que o usuário "recebe
notificação". Este é o fluxo em que ele efetivamente toma conhecimento.

**Caminho feliz**

1. O contador do sino mostra quantas notificações não foram lidas
2. O usuário abre a lista
3. Vê os avisos em ordem cronológica, com os não lidos destacados
4. Clica em um aviso
5. O sistema marca como lido e leva ao que originou a notificação

**Alternativos**

- **A1** — "Marcar todas como lidas": zera o contador sem abrir uma a uma
- **A2** — Filtra apenas as não lidas
- **A3** — Notificação de atividade já excluída: o aviso continua legível, mas sem destino

**Tipos gerados pelo sistema**

| Tipo | Originado em |
|---|---|
| `inscricao.aprovada` | FO-05 |
| `inscricao.recusada` | FO-06 |
| `atividade.cancelada` | FO-04, FS-05 |
| `certificado.emitido` | FO-09 |
| `certificado.revogado` | FS-09 |
| `certificado.restabelecido` | FS-09, quando a revogação é desfeita |

A recusa **não** traz motivo (D8), e o aviso de cancelamento **não** repete o motivo que a
ONG registrou — esse é da auditoria (D10). O da revogação aparece, porque já é público na
verificação.

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Nenhuma notificação | Estado vazio: "Você não tem avisos no momento" |

**Pós-condições:** notificações marcadas como lidas; contador atualizado

> Na v1 o aviso vive **dentro do sistema** (D16). O envio por e-mail entra depois,
> reaproveitando a mesma tabela — o registro já é criado hoje, falta só o disparo.

---

# ONG

## FO-01 — Criar rascunho

**Ator:** ONG · **Gatilho:** clica em "Criar atividade"

**Caminho feliz**

1. Abre `O3` com o formulário vazio
2. Preenche o que já sabe
3. Clica em "Salvar rascunho"
4. Grava com estado `rascunho` — **invisível para os alunos** (D6)
5. Aparece na aba Rascunhos de `O2`

**Alternativos**

- **A1** — Preenche tudo de uma vez e publica direto (FO-02), sem passar por rascunho
- **A2** — Volta depois para continuar
- **A3** — Descarta: confirma e sai sem salvar

**Exceções:** rascunho aceita campo faltando; só a publicação exige tudo válido

**Auditoria:** `atividade.rascunho_criado`

---

## FO-02 — Publicar atividade

**Ator:** ONG · **Pré-condições:** atividade em `rascunho`, com todos os campos válidos

**Caminho feliz**

1. Em `O2`, `O3` ou `O4`, clica em "Publicar"
2. O sistema valida tudo
3. Muda para `publicada`
4. Passa a aparecer na vitrine (se a data não passou)
5. Confirma: "Atividade publicada e já visível para os estudantes"

**Alternativos**

- **A1** — Exige aprovação (D1): o interruptor foi ligado e o selo aparece na vitrine
- **A2** — Pré-visualiza antes de publicar

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Campo obrigatório vazio | `400`, com todos os pendentes destacados |
| E2 | Data no passado | `400` — "A data não pode ser no passado" (RN-05) |
| E3 | Término antes do início | `400` (RN-06) |
| E4 | Carga horária inválida | `400` (RN-48). O formulário já sugere a partir do horário |
| E5 | Máximo menor que o mínimo | `400` (RN-08) |
| E6 | Não é a criadora | `403` (RN-11) |

**Pós-condições:** `publicada` · visível na vitrine

**Auditoria:** `atividade.publicada`

---

## FO-03 — Editar atividade

**Ator:** ONG · **Pré-condições:** ser a criadora; estado `rascunho` ou `publicada`

**Caminho feliz — sem inscritos**

1. Abre `O3`
2. Altera qualquer campo
3. Salva

**Caminho alternativo — com inscritos (RN-12)**

- **A1** — Só as vagas podem mudar. Os demais campos aparecem **bloqueados, com a
  explicação visível**: "Não pode ser alterado: já há 5 pessoas inscritas"

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Reduzir o máximo abaixo dos inscritos | `400` — "O máximo não pode ser menor que os 5 já inscritos" (RN-13) |
| E2 | Nova data no passado | `400` |
| E3 | Não é a criadora | `403` |
| E4 | Atividade `finalizada` | `403` — "Atividade finalizada não pode ser editada" |

**Auditoria:** `atividade.editada`, com `antes`/`depois` dos campos alterados

> Bloquear na interface com explicação é melhor que aceitar e ignorar em silêncio, como o
> sistema atual faz. O usuário precisa saber por que não pode.

---

## FO-04 — Cancelar atividade

**Ator:** ONG · **Pré-condições:** estado `publicada` ou `em_andamento`

**Caminho feliz**

1. Clica em "Cancelar atividade"
2. Confirma o aviso: "Os N inscritos serão notificados. Esta ação não pode ser desfeita"
3. Muda para `cancelada`
4. Sai da vitrine
5. As inscrições viram `cancelada`
6. Os inscritos recebem notificação no sistema (D16)

**Alternativos**

- **A1** — Sem inscritos: confirma sem o aviso de notificação
- **A2** — Já em `em_andamento`: permitido; check-ins registrados ficam sem efeito

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Já `finalizada` | `400` — "Atividade finalizada não pode ser cancelada" |
| E2 | Não é a criadora | `403` |

**Auditoria:** `atividade.cancelada`

---

## FO-05 — Aprovar inscrição

**Ator:** ONG · **Pré-condições:** atividade exige aprovação; há inscrição `pendente`

**Caminho feliz**

1. `O1` avisa: "N pessoas aguardando aprovação"
2. Abre `O5`
3. Vê nome, curso e instituição de cada candidato
4. Clica em "Aprovar"
5. A inscrição vira `confirmada`
6. O aluno recebe notificação no sistema (D16)

**Alternativos**

- **A1** — "Aprovar todas" resolve a fila em bloco
- **A2** — Abre o perfil público antes de decidir
- **A3** — O aluno cancelou antes: some da fila

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Inscrição já processada | `400` — "Esta inscrição já foi respondida" |
| E2 | Não é a criadora | `403` |
| E3 | Atividade já começou | `400` — "A atividade já começou" |

**Auditoria:** `inscricao.aprovada`

---

## FO-06 — Recusar inscrição

**Ator:** ONG · **Pré-condições:** as mesmas de FO-05

**Caminho feliz**

1. Em `O5`, clica em "Recusar"
2. Confirma — **sem campo de motivo** (D8)
3. A inscrição vira `recusada`
4. **A vaga volta** (RN-19)
5. O aluno vê apenas "Não aprovada"

**Exceções:** as mesmas de FO-05

**Auditoria:** `inscricao.recusada`

---

## FO-07 — Abrir painel de check-in ⭐

**Ator:** ONG · **Pré-condições:** atividade `em_andamento`

**Caminho feliz**

1. `O1` mostra "Abrir painel de check-in"
2. Abre `O6`
3. O sistema gera o primeiro token e exibe o QR
4. **O QR rotaciona a cada ~30 segundos**, com contagem regressiva visível
5. Conforme os alunos escaneiam, os nomes aparecem ao vivo
6. O contador mostra "14 de 20"

**Alternativos**

- **A1** — Tela cheia para projetar
- **A2** — Pausa a rotação por 60s quando alguém tem dificuldade de leitura
- **A3** — Registra manualmente quem está sem celular (FO-08)
- **A4** — Encerra o check-in e segue para `O7`

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Atividade não está `em_andamento` | `403` — "O check-in só abre no horário da atividade" |
| E2 | Não é a criadora | `403` |
| E3 | Conexão instável | O QR **para de rotacionar** e avisa; sem internet não há token novo |

**Auditoria:** `checkin.painel_aberto`

---

## FO-08 — Registrar check-in manual

**Ator:** ONG · **Pré-condições:** painel `O6` aberto

**Caminho feliz**

1. Clica em "Adicionar manualmente"
2. Busca o aluno na lista de inscritos
3. Confirma
4. O check-in é registrado com **origem `manual`**, distinta do QR

**Alternativos**

- **A1** — Vários seguidos: a busca continua aberta
- **A2** — Aluno não inscrito aparecendo no dia: **não pode**; precisa se inscrever antes

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Aluno já tem check-in | "Este aluno já registrou presença" |
| E2 | Aluno sem inscrição confirmada | "Este aluno não está inscrito na atividade" |

**Auditoria:** `checkin.registrado` com `origem: manual` (RN-43)

> Sem esta saída, quem esqueceu o celular seria punido por ter ido. A distinção de origem
> (RN-43) preserva a rastreabilidade: dá para ver quantos foram por QR e quantos pela mão
> da ONG.

---

## FO-09 — Validar presenças e finalizar ⭐

**Ator:** ONG · **Pré-condições:** atividade `aguardando_validacao`

**Caminho feliz**

1. `O1` mostra "Validar presenças"
2. Abre `O7`, **já pré-preenchida**: quem fez check-in vem marcado como presente
3. Revisa a lista com horário e origem de cada check-in
4. Ajusta o que precisar
5. Clica em "Confirmar e emitir certificados"
6. Confirma: "Serão emitidos 14 certificados de 4 horas. Esta ação não pode ser desfeita"
7. O sistema muda cada inscrição para `presente` ou `ausente`
8. Emite e **assina** um certificado para cada presente (D4)
9. A atividade vira `finalizada`
10. Os alunos recebem notificação no sistema (D16)

**Alternativos**

- **A1** — "Marcar todos os check-ins como presentes" preenche em bloco
- **A2** — "Marcar restantes como ausentes" resolve quem não apareceu
- **A3** — Aluno que fez check-in mas foi embora cedo: a ONG marca ausente; **o check-in fica no registro** e a divergência é auditável
- **A4** — Aluno sem check-in mas presente de fato: a ONG marca presente
- **A5** — "Voltar depois": salva sem finalizar
- **A6** — Todos ausentes: finaliza sem emitir nada
- **A7** — Ninguém se inscreveu: finaliza direto

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Alguém sem decisão | Botão desabilitado: "3 participantes ainda sem definição" (RN-03) |
| E2 | Já `finalizada` | `400` — "Esta atividade já foi finalizada" |
| E3 | Carga horária inválida | `400` (RN-15) |
| E4 | Não é a criadora | `403` (RN-11) |
| E5 | Falha ao assinar | `500`, **transação revertida** — nenhum certificado sai pela metade (RN-41) |

**Pós-condições:** atividade `finalizada` · certificados emitidos e assinados · horas
creditadas

**Auditoria:** `presenca.validada` por aluno · `certificado.emitido` por certificado ·
`atividade.finalizada`

---

## FO-10 — Excluir rascunho

**Ator:** ONG · **Pré-condições:** estado `rascunho`

**Caminho feliz**

1. Clica em "Excluir"
2. Confirma
3. Removido definitivamente

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Não está em `rascunho` | O botão **nem aparece** (RN-18) |
| E2 | Chamada direta à API em atividade publicada | `403` — "Só rascunho pode ser excluído" |

> **RN-18 fecha a falha L3** documentada em [requisitos.md](requisitos.md): hoje é possível
> apagar uma atividade finalizada e destruir certificados já entregues.

---

## FO-11 — Manter perfil da ONG

**Ator:** ONG · **Gatilho:** abre `O8`

Nome, CNPJ, descrição, contato, endereço, redes e logo. Segue o padrão de FE-09.

> O perfil bem preenchido é o que aparece no cartão da vitrine e em `T5`. Vale sinalizar
> na interface: "Perfis completos recebem mais inscrições".

---

# Verificador

## FV-01 — Verificar por QR ⭐

**Ator:** verificador, **sem conta** · **Gatilho:** recebeu um certificado

**Caminho feliz**

1. Escaneia o QR do PDF com a câmera do celular
2. O navegador abre `T6`
3. A página consulta a API pelo código
4. O servidor **confere a assinatura** além de buscar o registro
5. Exibe os dados e os três selos: *existe* · *não revogado* · *assinatura confere*
6. O verificador confirma que é legítimo

**Alternativos**

- **A1** — Baixa o PDF oficial pelo botão, obtendo o documento da fonte
- **A2** — Verifica vários: usa "Verificar outro código"

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Código inexistente | `404` — "Nenhum certificado com este código" |
| E2 | Certificado revogado | Mostra os dados com aviso destacado de invalidação |
| E3 | **Assinatura não confere** | **Alerta de fraude** — o registro existe mas foi adulterado |
| E4 | Sem internet | "Não foi possível verificar agora" — a verificação exige rede, por causa da revogação |

> **E3 é o cenário que a assinatura existe para pegar.** Um invasor que escreveu no banco
> produz um registro que "existe", mas não consegue assinatura válida sem a chave privada.

---

## FV-02 — Verificar por código digitado

**Ator:** verificador · **Gatilho:** tem o código, não o QR

Idêntico a FV-01 a partir do passo 3. Cobre o caso do sistema da faculdade que só armazena
o código, ou do certificado impresso com o QR danificado.

---

# Superadmin

## FS-01 — Primeiro acesso

**Ator:** operador com acesso ao servidor · **Gatilho:** implantação inicial

**Caminho feliz**

1. Executa `python -m app.cli criar-admin` no servidor
2. Informa e-mail e senha forte
3. A conta é criada com papel `superadmin`
4. Entra por `T7`, como qualquer um
5. É levado a `A1`

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail já existe | O comando recusa |
| E2 | Senha fraca | O comando exige mínimo de 12 caracteres |

**Auditoria:** `admin.criado` com origem `cli`

> Não existe tela nem endpoint público que crie admin (RN-27). Quem não tem acesso ao
> servidor não tem como virar administrador.

---

## FS-02 — Investigar via auditoria

**Ator:** superadmin · **Gatilho:** alguém relatou um problema

**Caminho feliz**

1. Abre `A2`
2. Filtra por período, ator, ação ou entidade
3. Expande a linha e vê `antes`/`depois`
4. Navega para o ator (`A4`) ou para a entidade
5. Entende o que aconteceu

**Alternativos**

- **A1** — Exporta o recorte em CSV
- **A2** — Filtra "só ações de admin" para revisar a própria equipe
- **A3** — Filtra "só via entrar como" para auditar o suporte
- **A4** — Chegou por um alerta de `A1`: já vem filtrado

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Nenhum registro no filtro | Estado vazio sugerindo ampliar o período |
| E2 | Tentativa de editar ou apagar | **Não existe** botão nem endpoint (RN-33) |

**Auditoria:** `auditoria.consultada` — sim, consultar a auditoria também é auditado

---

## FS-03 — Redefinir senha de um usuário

**Ator:** superadmin · **Gatilho:** usuário não consegue entrar

**Caminho feliz**

1. Encontra a pessoa em `A3` e abre `A4`
2. Clica em "Redefinir senha"
3. Confirma
4. O sistema dispara o e-mail de redefinição (FA-04)
5. **O admin não vê nem define a senha** (D12)
6. Confirma: "Link enviado para maria@email.com"

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | E-mail inválido no cadastro | "Corrija o e-mail antes de disparar a redefinição" |
| E2 | Conta suspensa | "Reative a conta antes" |
| E3 | Alvo é outro superadmin | Permitido, e registrado com destaque |

**Auditoria:** `senha.redefinicao_disparada` com quem disparou e para quem

---

## FS-04 — Entrar como usuário ⭐

**Ator:** superadmin · **Pré-condições:** conta ativa, que não seja `superadmin` (RN-30)

**Caminho feliz**

1. Em `A4`, clica em "Entrar como"
2. Confirma o aviso: "Modo somente leitura. Tudo será registrado"
3. O sistema abre uma **sessão espelho** com validade de 30 minutos
4. A interface vira a do usuário, com **tarja fixa** no topo
5. O admin navega e vê o que a pessoa vê
6. **Toda ação de escrita está desabilitada** (RN-29)
7. Clica em "Sair do modo" e volta a `A1`

**Alternativos**

- **A1** — Deixa expirar: a sessão espelho morre sozinha em 30 min (RN-31)
- **A2** — Precisa mesmo alterar algo: sai do modo e usa o console (`A6`, `A7`), que registra como ação de admin

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Alvo é outro superadmin | `403` — "Não é possível entrar como outro administrador" |
| E2 | Conta suspensa | `403` — "Reative a conta primeiro" |
| E3 | Tentativa de escrita no modo espelho | `403` — "Modo somente leitura" |
| E4 | Sessão espelho expirou | Volta ao console com aviso |

**Auditoria:** `admin.entrou_como` na entrada · toda navegação registrada com
`em_nome_de` preenchido · `admin.saiu_do_modo` na saída

> É a diferença entre **observar** e **se disfarçar**. O admin resolve o problema de
> suporte sem que ninguém perca a capacidade de provar quem fez o quê.

---

## FS-05 — Suspender e reativar conta

**Ator:** superadmin · **Gatilho:** conduta imprópria ou pedido do titular

**Caminho feliz**

1. Em `A3` ou `A4`, clica em "Suspender"
2. Informa o motivo — **obrigatório**
3. Confirma
4. A conta perde o acesso e todas as sessões são revogadas
5. Sendo ONG, as atividades saem da vitrine (RN-36)

**Alternativos**

- **A1** — Reativar: restaura o acesso. **As atividades canceladas na suspensão não voltam** — os inscritos já foram avisados e liberados
- **A2** — Suspender ONG: as atividades que ainda não começaram são canceladas e os inscritos notificados (RN-51). As que já começaram ficam, fora da vitrine (RN-36), e podem ter a validação forçada (FS-08)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Suspender a si mesmo | `400` — "Você não pode suspender a própria conta" |
| E2 | Último admin ativo | `400` — "É preciso haver ao menos um administrador ativo" (RN-44) |

**Auditoria:** `conta.suspensa` / `conta.reativada` com motivo

> **Suspender não apaga (RN-40).** O histórico, os certificados emitidos e a auditoria
> permanecem — apagar destruiria comprovação legítima de alunos que não têm culpa nenhuma,
> e ainda eliminaria a evidência necessária para investigar a própria ONG.

---

## FS-06 — Encerrar sessões de um usuário

**Ator:** superadmin · **Gatilho:** suspeita de conta comprometida

**Caminho feliz**

1. Em `A4`, vê as sessões ativas com IP, dispositivo e último uso
2. Clica em "Encerrar sessões"
3. Todos os refresh tokens são revogados
4. A pessoa precisa entrar de novo (FA-03 E4)

**Auditoria:** `sessoes.revogadas`

---

## FS-07 — Editar atividade de terceiro

**Ator:** superadmin · **Gatilho:** erro que a ONG não corrige

**Caminho feliz**

1. Encontra a atividade em `A6`
2. Clica em "Editar"
3. Confirma o aviso: "Esta edição ficará visível como edição administrativa"
4. Altera e salva
5. A atividade passa a exibir **"editada pela administração em <data>"** para a ONG e os
   inscritos (RN-35)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Atividade `finalizada` | `403` — não se altera atividade que já gerou certificado |
| E2 | Reduzir vagas abaixo dos inscritos | `400`, mesma trava da RN-13 |

**Auditoria:** `atividade.editada_por_admin` com `antes`/`depois`

---

## FS-08 — Forçar validação

**Ator:** superadmin · **Pré-condições:** atividade parada em `aguardando_validacao` há muito tempo

**Caminho feliz**

1. `A1` alerta sobre a atividade parada
2. Abre em `A6` e clica em "Forçar validação"
3. **Confirmação reforçada**, exigindo motivo
4. Escolhe a política: tratar quem tem check-in como presente, ou marcar todos ausentes. **A política vale só para quem ainda está sem decisão** — o que a ONG já marcou é respeitado
5. O sistema aplica, emite os certificados e finaliza

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Menos de 7 dias parada | O botão não aparece — a ONG ainda tem prazo |
| E2 | Nenhum check-in registrado | Só a opção de marcar todos ausentes |

**Auditoria:** `atividade.validacao_forcada` com motivo e política

> Existe porque a alternativa é pior: sem isso, a ONG que somem deixa os alunos sem o
> certificado que eles ganharam.

---

## FS-09 — Revogar certificado

**Ator:** superadmin · **Gatilho:** certificado emitido indevidamente

**Caminho feliz**

1. Encontra em `A7` por código, aluno, ONG ou atividade
2. Clica em "Revogar"
3. **Informa o motivo — obrigatório** (D14)
4. Confirma
5. O certificado é marcado como revogado; **o registro permanece** (RN-25)
6. `T6` passa a exibir o aviso de revogação
7. O aluno recebe notificação no sistema (D16)

**Alternativos**

- **A1** — Reverter a revogação: possível, e auditado
- **A2** — Revogar em lote todos de uma atividade fraudulenta

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Já revogado | `400` — "Este certificado já está revogado" |
| E2 | Tentativa de emitir | **Não existe** botão nem endpoint (D14) |

**Auditoria:** `certificado.revogado` com motivo

> **Revogar exige motivo; recusar inscrição não** (D8). A diferença é proporcional ao
> impacto: recusar afeta uma pessoa antes do evento; revogar desfaz um documento que já
> circulou e pode ter sido entregue a uma faculdade.

---

## FS-10 — Criar outro administrador

**Ator:** superadmin · **Gatilho:** ampliar a equipe de operação

**Caminho feliz**

1. Em `A3`, clica em "Criar administrador"
2. Informa nome e e-mail
3. **Reconfirma a própria senha** (RN-37)
4. A conta é criada e recebe o link para definir a senha
5. O novo admin nunca tem senha definida por outra pessoa (D12)

**Exceções**

| # | Situação | Resposta |
|---|---|---|
| E1 | Senha do admin incorreta | `403` — "Senha incorreta" |
| E2 | E-mail já cadastrado | `409` |

**Auditoria:** `admin.criado` com quem criou

---

## FS-11 — Verificar integridade das assinaturas

**Ator:** superadmin · **Gatilho:** auditoria periódica ou suspeita de invasão

**Caminho feliz**

1. Em `A8`, clica em "Verificar todos os certificados"
2. O sistema percorre a base recalculando cada assinatura
3. Reporta: total conferido, válidos, divergentes

**Alternativos**

- **A1** — Tudo válido: relatório limpo, com data
- **A2** — **Há divergência**: lista os afetados — indício forte de escrita direta no banco
- **A3** — Baixa a chave pública para auditoria externa independente

**Auditoria:** `integridade.verificada` com o resultado

> É a contraprova do sistema. Se alguém invadiu o banco e inseriu certificados, é aqui que
> aparece.

---

# Transições automáticas

Acontecem por tempo, sem ninguém clicar — e sem nenhum processo em segundo plano.

> **São calculadas na leitura** (D22). O banco guarda só `rascunho`, `publicada`,
> `finalizada` e `cancelada`; `em_andamento` e `aguardando_validacao` saem da comparação
> entre o horário da atividade e o relógio, em `America/Sao_Paulo` (RN-53, RN-54).
>
> Não há tarefa agendada para cair em silêncio, nem atraso entre "deu a hora" e "o sistema
> percebeu".

## FT-01 — Publicada → Em andamento

Ao chegar a data e a hora de início: a atividade muda de estado, o check-in é liberado
(`O6` e `E5` passam a funcionar) e as inscrições encerram. **Continua na vitrine**, agora
com "Inscrições encerradas".

## FT-02 — Em andamento → Aguardando validação

Ao passar a hora de término: o check-in fecha, a atividade sai da vitrine e a ONG passa a
ver "Validar presenças". Nenhum certificado é emitido ainda — depende de FO-09.

## FT-03 — Expiração do token de check-in

A cada ~30 segundos o token vence e outro é gerado. **É a proteção central do QR dinâmico**:
o print compartilhado chega vencido.

## FT-04 — Expiração de sessão

Access token vence em 15 min e é renovado automaticamente (FA-03). Refresh vence em 7 dias
e exige login novo. Sessão espelho de admin vence em 30 min e não renova.

---

# Fluxos transversais

## FX-01 — Sessão expirada

Vale para qualquer operação autenticada.

```
requisição
    │
 ┌──┴───┐
 │      │
 ok   401
 │      │
 │      ▼
 │  renova (FA-03)
 │      │
 │   ┌──┴───┐
 │   │      │
 │  ok    falhou
 │   │      │
 ▼   ▼      ▼
 executa   volta ao login
 (refaz)   com aviso
```

O usuário só percebe quando a renovação falha.

## FX-02 — Permissão negada

| Situação | Resposta |
|---|---|
| Papel errado para a rota | `403` — "Você não tem acesso a esta área" |
| Não é dono do recurso | `403` — "Acesso negado" (RN-11) |
| Escrita no modo espelho | `403` — "Modo somente leitura" (RN-29) |
| URL de outro perfil | Redireciona ao painel correto, sem erro |

## FX-03 — Falha de rede

A tela mostra estado de erro com botão de tentar de novo, preservando o que foi digitado.

Operações de escrita **não são repetidas automaticamente** (RN-39) — repetir um "finalizar
atividade" poderia emitir a segunda leva de certificados. Leitura pode ser repetida à
vontade; escrita exige que a pessoa decida.

## FX-04 — Limite de tentativas

20 tentativas por IP a cada 15 minutos em cadastro e login. Estourou: `429` com o tempo de
espera. As tentativas ficam registradas para investigação posterior.

---

# Cenários ponta a ponta

## C1 — O caminho completo, sem obstáculo

```
ONG                          ALUNO                      COORDENAÇÃO
 │                             │                             │
 │ FA-01 cria conta            │ FA-01 cria conta            │
 │ FO-01 monta rascunho        │                             │
 │ FO-02 publica               │                             │
 │                             │ FE-01 encontra              │
 │                             │ FE-02 inscreve-se           │
 │                             │                             │
 │  ══════════ FT-01: começa o evento ══════════             │
 │                             │                             │
 │ FO-07 abre o QR             │ FE-05 faz check-in          │
 │                             │                             │
 │  ══════════ FT-02: evento termina ═══════════             │
 │                             │                             │
 │ FO-09 valida e finaliza ────┼──► certificado emitido      │
 │                             │ FE-07 baixa o PDF           │
 │                             │ FE-08 entrega ─────────────►│
 │                             │                             │ FV-01 escaneia
 │                             │                             │ ✅ confirmado
```

## C2 — Atividade com aprovação e uma desistência

1. A ONG publica com aprovação exigida (FO-02 A1)
2. Cinco alunos se inscrevem → todos `pendente`, cinco vagas reservadas (FE-03)
3. A ONG aprova quatro (FO-05) e recusa um (FO-06) → uma vaga volta
4. Um aprovado desiste na véspera (FE-04) → outra vaga volta
5. Um sexto aluno se inscreve na vaga liberada
6. Evento acontece com quatro presentes
7. Quatro certificados emitidos (FO-09)

## C3 — O aluno que esqueceu o celular

1. O aluno chega ao evento sem bateria
2. Não consegue fazer o check-in (FE-05 A3)
3. Avisa a ONG, que o registra manualmente (FO-08)
4. O check-in fica com origem `manual`
5. Em FO-09, ele aparece pré-marcado como presente, igual aos outros
6. Recebe o certificado normalmente

> A tecnologia não pune quem foi ao evento.

## C4 — Tentativa de fraude por print do QR

1. João não vai, mas pede a Maria que mande foto do QR
2. Maria fotografa e envia pelo WhatsApp
3. João escaneia 40 segundos depois
4. **O token já venceu** (FT-03) → FE-05 E1
5. Para conseguir, João precisaria de foto nova a cada 30s, em tempo real
6. O custo do ataque supera o de simplesmente ir ao evento

## C5 — Tentativa de fraude por invasão do banco

1. Um invasor obtém acesso de escrita ao banco
2. Insere uma linha na tabela de certificados
3. A verificação encontra o registro — o selo *existe* passa
4. **A assinatura não confere** — o invasor não tem a chave privada
5. `T6` exibe o alerta de adulteração (FV-01 E3)
6. FS-11 lista todos os registros forjados

## C6 — ONG some sem validar

1. O evento termina e entra em `aguardando_validacao` (FT-02)
2. A ONG não valida por 8 dias
3. Os alunos ficam sem certificado
4. `A1` alerta o superadmin
5. FS-08 força a validação, tratando quem tem check-in como presente
6. Os certificados saem, com o motivo registrado na auditoria

---

## Rastreabilidade

| Documento | Relação |
|---|---|
| [especificacao.md](especificacao.md) | Define atores, estados, telas e regras que estes fluxos exercitam |
| [requisitos.md](requisitos.md) | Retrato do sistema atual — mostra a distância até este alvo |
| [desafio-tecnico.md](desafio-tecnico.md) | Fundamenta C4 e C5 |
| [autenticacao.md](autenticacao.md) | Detalha FA-02 a FA-05 |
