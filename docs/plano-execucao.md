# Plano de Execução — Mais Horas

Como sair do código atual e chegar ao sistema definido em
[especificacao.md](especificacao.md), sem ficar semanas com nada funcionando.

---

## 1. Decisões de execução

| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| **D38** | Estratégia | **Fatia vertical** — uma funcionalidade completa por vez, do banco à tela | O sistema roda o tempo todo; dá para demonstrar em qualquer momento |
| **D39** | E-mail | **Console em dev**, provedor real só no deploy | Destrava a recuperação de senha (D15) sem depender de serviço externo agora |
| **D40** | Testes | **pytest junto com cada fatia** | Resolve a dívida de cobertura em vez de arrastá-la; `smoke_test.py` é aposentado ao final |

---

## 2. O problema que o plano resolve

O código de hoje funciona — 68 verificações passando. Mas o alvo muda o contrato inteiro:

| | Hoje | Alvo |
|---|---|---|
| Rotas | `/api/activities` | `/api/v1/atividades` |
| Identificador | `_id` | `id` |
| Erro | `{ message, details }` | `{ codigo, mensagem, detalhes }` |
| Tabelas | inglês | português |

**Backend e frontend quebram juntos.** Por isso a ordem importa: cada fatia leva uma
funcionalidade de ponta a ponta, deixando o sistema sempre utilizável — com menos recursos,
nunca quebrado.

---

## 3. As fatias

### Fatia 0 — Fundação ✅ concluída

Única que não é vertical: não tem tela, mas nada existe sem ela.

- As 8 migrations do [modelo-dados.md](modelo-dados.md), com as tabelas em português
- Modelos SQLAlchemy e esquemas Pydantic
- `core/config`, `core/security` (Argon2id, Ed25519, JWT), `core/errors` no formato novo
- `pytest` configurado, com banco de teste isolado
- Geração e carga da chave de assinatura

**Pronto quando:** `alembic upgrade head` cria as 10 tabelas e o pytest roda sem erro.

**Entregue:** migration única criando as 10 tabelas em português mais a view
`atividades_com_situacao`, que calcula `em_andamento` e `aguardando_validacao` a partir do
relógio (D22) · modelos SQLAlchemy com as restrições declaradas no banco · `core/security`
com Argon2id, JWT, refresh, assinatura Ed25519 e token de check-in derivado do tempo ·
`core/errors` no formato `{ codigo, mensagem, detalhes }` · `app/cli.py` para gerar chaves e
criar o primeiro administrador · **45 testes em pytest**, com banco isolado.

O código antigo que dependia do schema em inglês foi removido — routers, services, schemas,
utils e o `smoke_test.py`. Volta fatia a fatia, no contrato novo.

---

### Fatia 1 — Acesso ✅ concluída

**Backend:** `/auth/cadastro` · `/entrar` · `/renovar` · `/sair` · `/senha/esqueci` · `/senha/redefinir`
**Frontend:** `T7` Entrar · `T8` Criar conta · `AuthContext` no contrato novo
**Fluxos:** FA-01 a FA-05 · **Regras:** RN-17, RN-22, RN-38, RN-42

**Pronto quando:** dá para criar conta, entrar, recarregar a página sem perder a sessão e
recuperar a senha pelo link que aparece no terminal.

**Entregue:** as 6 rotas de `/auth` · cookie httpOnly com escopo restrito · rotação de
refresh com janela de graça · auditoria escrita desde já · limite de tentativas · e-mail no
console (D39) · telas T7, T8, esqueci e redefinir senha · **32 testes** cobrindo FA-01 a
FA-05, incluindo as exceções.

Verificado no navegador: conta criada pela interface, sessão sobrevivendo a três
recarregamentos seguidos, token fora do `localStorage`, nenhum cookie visível ao
JavaScript, e um único refresh por carga — a promessa compartilhada evita a corrida do
StrictMode.

---

### Fatia 2 — Perfil ✅ concluída

**Backend:** `/perfil` (ler, atualizar, foto) · `/usuarios/{id}/publico`
**Frontend:** `E7` Meu perfil · `O8` Perfil da ONG
**Fluxos:** FE-09 · **Regras:** RN-13 (perfil mínimo)

**Pronto quando:** o aluno preenche o perfil e o sistema sabe dizer se está completo.

**Entregue:** 5 rotas de perfil · `perfilCompleto` e `camposFaltantes` na resposta, que é o
sinal que a vitrine vai consultar antes de liberar a inscrição · upload de foto com troca
apagando a anterior · perfil público reduzido, sem telefone nem e-mail de estudante · tela
única servindo aos dois papéis · **26 testes**.

Verificado no navegador: o aviso lista os três campos que faltam, vira "perfil completo" ao
preencher, e a foto sobe, é servida pela API e renderiza.

---

### Fatia 3 — Atividades ✅ concluída

**Backend:** CRUD, rascunho, publicar, cancelar, vitrine paginada e filtrada no servidor
**Frontend:** `E2` Vitrine · `E3` Detalhe · `O2` Minhas atividades · `O3` Criar/editar · `O4` Gerenciar
**Fluxos:** FE-01, FO-01 a FO-04, FO-10 · **Regras:** RN-05 a RN-11, RN-20, RN-47 a RN-49

**Pronto quando:** a ONG publica uma atividade e o aluno a encontra na vitrine. ✅

Entregue: `app/schemas/atividade.py`, `app/services/atividade_service.py`,
`app/routers/atividades.py`, 57 testes em `tests/test_atividades.py`; no frontend,
`components/atividade/`, `components/layout/PainelLayout.jsx`,
`components/ui/ConfirmarAcao.jsx` e as cinco telas.

Três decisões tomadas durante a implementação:

- **As abas derivadas de `O2` filtram no servidor.** "Acontecendo" e "A validar" não
  existem no banco, mas separá-las no navegador daria total e paginação errados — a
  consulta compara `data`/`hora` contra o relógio do Brasil, calculado em Python para não
  depender do fuso configurado no Postgres.
- **`tzdata` entrou nas dependências.** Sem ele, `ZoneInfo("America/Sao_Paulo")` falha no
  boot em Windows e em imagens enxutas de servidor.
- **Data pura ganhou formatação própria no frontend.** `new Date("2026-09-20")` é lido
  como meia-noite UTC e no Brasil renderiza o dia 19; toda atividade apareceria um dia
  antes.

---

### Fatia 4 — Inscrições ✅ concluída

**Backend:** inscrever, cancelar, aprovar, recusar, listar
**Frontend:** `E4` Minhas inscrições · `O5` Inscrições
**Fluxos:** FE-02 a FE-04, FE-06, FO-05, FO-06 · **Regras:** RN-01, RN-12, RN-14, RN-19

**Pronto quando:** o aluno se inscreve, a ONG aprova, e o limite de 5 inscrições barra
quem passar do teto. ✅

Entregue: `app/schemas/inscricao.py`, `app/services/inscricao_service.py`,
`app/routers/inscricoes.py`, 50 testes em `tests/test_inscricoes.py`; no frontend,
`components/atividade/BotaoInscricao.jsx` e as duas telas.

Quatro decisões tomadas durante a implementação:

- **A inscrição trava a linha da atividade (`SELECT ... FOR UPDATE`).** Duas pessoas
  clicando na última vaga ao mesmo tempo leriam as duas "resta 1" e as duas entrariam. A
  restrição de unicidade não pega esse caso, porque são alunos diferentes.
- **Reinscrever reaproveita a linha.** O par (atividade, aluno) é único no banco, então
  quem cancelou e volta atrás (FE-04 A3) tem a mesma inscrição reativada, não uma nova.
- **`aprovar-lote` recebe os ids, não "todas as pendentes".** "Aprovar todas" aprova o que
  a ONG viu na tela; quem se inscreveu entre o carregamento e o clique fica de fora, que é
  o certo. O lote devolve um placar em vez de tudo-ou-nada: uma inscrição cancelada no
  meio do caminho não pode derrubar as aprovações válidas nem sumir em silêncio.
- **O teto da RN-46 conta só o que ainda vai acontecer.** Contar inscrição de atividade
  passada travaria o aluno para sempre depois de cinco participações.

---

### Fatia 5 — Presença e check-in ⭐ ✅ concluída

O diferencial técnico do projeto.

**Backend:** token derivado do tempo, `/checkin`, registro manual, validação de presença
**Frontend:** `E5` Check-in · `O6` Painel de QR rotativo · `O7` Validar presenças
**Fluxos:** FE-05, FO-07 a FO-09 · **Regras:** RN-03, RN-04, RN-15 a RN-17, RN-43

**Pronto quando:** o QR rotaciona a cada 30 s, o aluno registra presença lendo a tela, e um
código de 40 segundos atrás é recusado. ✅

Entregue: `app/services/checkin_service.py`, `app/routers/checkin.py`,
`app/schemas/checkin.py`, 43 testes em `tests/test_checkin.py`; no frontend,
`pages/estudante/Checkin.jsx`, `pages/ong/PainelCheckin.jsx` e
`pages/ong/ValidarPresencas.jsx`.

**O formato do token mudou** — de `MH1.<hmac>` para
`MH1.<atividade>.<janela>.<assinatura>`. O formato antigo, opaco, não atendia ao
contrato por dois motivos:

- `POST /checkin` recebe **só o token** (o corpo não diz de qual atividade é), então o
  próprio token precisa carregar essa informação.
- Sem saber a atividade e a janela, o servidor não distinguia "código vencido" de "código
  de outra atividade" — e o fluxo FE-05 exige mensagens diferentes para os dois, porque
  vencer é o caso comum e não é erro de ninguém.

Carregar atividade e janela em claro não enfraquece nada: quem protege é a assinatura
HMAC, que continua exigindo o segredo do servidor.

Outras duas decisões:

- **A expiração virou determinística.** Antes o servidor aceitava a janela anterior
  inteira, o que fazia um código viver de 30 a 60 s conforme a hora em que fosse gerado —
  e o critério "40 s atrás é recusado" valia ou não conforme a fase do relógio. Agora a
  folga é medida a partir do **fim** da janela (10 s por padrão), então **nenhum código
  passa de 40 s de vida**, em qualquer instante. Há um teste que varre os 30 segundos da
  janela para provar isso.
- **A abertura do painel é auditada uma vez a cada 15 minutos.** O cliente rebusca o token
  a cada 30 s; auditar cada busca encheria a trilha de ruído sem dizer nada novo.

**Pendente para a Fatia 6:** `POST /atividades/{id}/finalizar` fecha a atividade e credita
as horas, mas **ainda não emite certificados**. A emissão entra na fatia seguinte e será
atômica com a finalização (RN-41). Atividade finalizada antes disso não gera certificado
retroativamente.

---

### Fatia 6 — Certificado ⭐

**Backend:** emissão assinada em Ed25519, PDF com QR, verificação pública, revogação
**Frontend:** `E6` Meus certificados · `T6` Verificação pública
**Fluxos:** FE-07, FE-08, FV-01, FV-02 · **Regras:** RN-02, RN-18, RN-19, RN-24, RN-56

**Pronto quando:** o ciclo fecha — atividade finalizada emite certificado assinado, e a
página pública mostra os três selos. **É aqui que o sistema vira demonstrável de ponta a
ponta.** ✅

Entregue: `app/services/certificado_service.py`, `app/routers/certificados.py`,
`app/routers/admin.py` (só a revogação, por enquanto), 38 testes em
`tests/test_certificados.py`; no frontend, `pages/estudante/MeusCertificados.jsx`,
`pages/public/VerificarCertificado.jsx` e `utils/baixar.js`.

Verificado no navegador: ciclo completo pela API real, página pública válida, e um
certificado adulterado direto no banco (`horas = 30`) acusado com o alerta vermelho e sem
botão de PDF.

Decisões tomadas durante a implementação:

- **O texto assinado passou a cobrir todos os campos exibidos.** O da Fatia 0 assinava
  código, aluno, título, horas e emissão — mas não a organização nem a data da atividade,
  que a verificação pública mostra. Quem escrevesse no banco podia trocar o nome da ONG e o
  certificado seguia "válido". Agora é uma lista JSON versionada (`MHC1`) com os sete
  campos. JSON em vez de texto separado por `|` porque, com separador, um nome contendo `|`
  poderia deslocar conteúdo de um campo para o vizinho sem mudar o texto assinado. Nenhum
  certificado tinha sido emitido ainda, então a troca não invalidou nada.
- **A chave é conferida antes de mexer em qualquer coisa.** Sem ela a finalização devolve
  `503 emissao_indisponivel` e a atividade fica intacta. Falha no meio da emissão reverte
  tudo, inclusive os certificados já assinados na mesma rodada (RN-41).
- **PDF só sai de registro íntegro.** Imprimir um registro adulterado com o timbre da Mais
  Horas daria ao invasor exatamente o documento que ele queria. O PDF oficial público sai
  só de certificado válido; o aluno mantém o do revogado, com marca d'água "REVOGADO".
- **Só a adulteração vai para a auditoria** (`integridade.verificada`). As verificações
  comuns são públicas e frequentes, e registrá-las afogaria o evento que importa.
- **A revogação entrou já nesta fatia**, em `/admin/certificados/{id}/revogar`, porque sem
  ela o desfecho "revogado" não existiria. O restante do console fica para a Fatia 8.
- **A fixture de teste foi corrigida.** A sessão de teste não imitava a produção: um
  `rollback()` desfazia o teste inteiro, e o teste de atomicidade passava por vacuidade —
  "nenhum certificado" era verdade porque nem a atividade existia mais. Com
  `join_transaction_mode="create_savepoint"`, `commit` vale até o fim do teste e `rollback`
  desfaz só o que não foi commitado. O teste agora confere que a atividade continua lá.

**Resolvido o pendente da Fatia 5:** a finalização agora emite os certificados, na mesma
transação.

---

### Fatia 7 — Notificações ✅ concluída

**Backend:** `/notificacoes` · **Frontend:** sino no cabeçalho
**Fluxos:** FE-10 · **Regras:** D16

Entregue: `app/services/notificacao_service.py`, `app/routers/notificacoes.py`, 20 testes
em `tests/test_notificacoes.py`; no frontend, `components/notificacao/` (sino, item e o
evento de sincronização) e `pages/Notificacoes.jsx`.

Verificado no navegador: aprovação e cancelamento reais geraram dois avisos, o sino mostrou
2, abrir um aviso marcou como lido e levou a "Minhas inscrições", e "marcar todas" na
página zerou o sino.

Decisões tomadas durante a implementação:

- **`notificar()` não dá commit**, como `auditoria.registrar()`. O aviso entra na transação
  de quem aprova, cancela ou emite: se a operação cai, o aviso cai junto. Há teste que
  derruba a emissão no meio e confere que nenhum aviso de certificado ficou — e que a
  atividade continua existindo, para o teste não passar por vacuidade.
- **Os textos moram num lugar só**, e é lá que ficam as regras de silêncio: a recusa não
  sugere motivo (D8) e o cancelamento não repete o motivo que a ONG escreveu para a
  auditoria (D10). O motivo da **revogação** aparece, porque já é público na verificação.
- **Catálogo de tipos fechado**, como o da auditoria. Entrou um sexto tipo,
  `certificado.restabelecido`: sem ele, quem teve a revogação desfeita ficaria com o
  último aviso dizendo que o certificado não vale.
- **Link só interno.** O frontend navega para o link do aviso; aceitar URL externa faria do
  sino um redirecionamento aberto. O servidor descarta, e o cliente confere de novo.
- **`criado_em` vem do Python, não do `NOW()` do banco.** No Postgres, `NOW()` é a hora do
  início da transação: avisos criados juntos (o cancelamento avisa todos os inscritos de
  uma vez) empatariam, e a ordem na lista viraria sorteio.
- **Só o contador roda sozinho** — ao montar, a cada troca de tela, a cada minuto com a aba
  visível e quando a janela volta ao foco. A lista só é buscada quando o painel abre.
- **A página avisa o sino por evento.** Os dois não compartilham estado, e "marcar todas"
  na página deixava o sino com o número antigo até a próxima troca de tela.

---

### Fatia 8 — Console administrativo

**Backend:** `/admin/*`, trilha de auditoria alimentada por todas as fatias anteriores
**Frontend:** `A1` a `A8`
**Fluxos:** FS-01 a FS-11 · **Regras:** RN-23 a RN-26, RN-32 a RN-34, RN-40, RN-44

> A auditoria é escrita desde a Fatia 1 — o console só a lê. Adiar a escrita significaria
> voltar em todas as fatias depois.

**Parte 1 ✅ — console (A1 a A8).** Entregue: `admin_painel_service.py`,
`admin_contas_service.py`, `admin_conteudo_service.py`, 25 rotas em `routers/admin.py`,
57 testes em `tests/test_admin.py` e as oito telas em `pages/admin/`. Verificado no
navegador: visão geral com alertas reais, integridade das assinaturas, suspensão com motivo
obrigatório e reativação, e a trilha registrando cada passo — inclusive as leituras.

**Parte 2 ✅ — "entrar como" (A4b, FS-04):** a sessão espelho somente leitura, entregue
separada por ser a peça mais sensível do sistema. Backend em `core/deps.py`
(`_conferir_espelho`, `SessaoEspelho`), `admin_contas_service.entrar_como`/`sair_do_modo`,
25 testes em `tests/test_espelho.py`. Frontend: `TarjaEspelho`, modo espelho em
`services/api.js` e `AuthContext`, botão no detalhe do usuário. Verificado no navegador:
entrar como aluna, navegar, escrita recusada sem sair requisição, saída pelo botão e por
expiração voltando ao detalhe da conta, tarja em 375px e a trilha completa na auditoria.

Decisões da parte 2:

- **O token espelho é um JWT comum com `espelho`, `adm` e `sid`, lastreado numa linha de
  `tokens_sessao`** (com `em_nome_de` = admin). A cada requisição a API confere a linha, o
  admin (ativo e superadmin) e o alvo. Revogar a linha — sair do modo, encerrar sessões do
  admin — mata o token na hora, sem esperar os 30 minutos.
- **Sem refresh.** O interceptor não tenta renovar um 401 no espelho: o cookie é do admin,
  e renovar trocaria o token em silêncio com a tela ainda achando que está no espelho.
- **Escrita é barrada no servidor** (`403 modo_somente_leitura`), com uma única exceção:
  `POST /admin/sair-do-modo`. O cliente barra antes, com a mesma mensagem, só para poupar a
  ida e a volta. Os botões não ficam desabilitados um a um (a A4b previa isso): seria
  preciso tocar em toda tela, e esquecer uma só daria falsa sensação de ação possível. A
  recusa central não esquece nenhuma.
- **A navegação é auditada no servidor**: cada `GET` com token espelho grava
  `admin.navegou_como` com o caminho. O contador do sino fica de fora — é consulta
  automática a cada minuto, não navegação.
- **O QR do painel de check-in é recusado no espelho.** É leitura, mas entrega uma
  credencial válida por 40 s: o admin poderia registrar presença pela ONG.
- **Recarregar a página encerra o espelho no navegador** — o token vive só em memória — e
  volta à sessão do admin pelo cookie. A linha fica aberta até expirar; não há como
  revogá-la sem o token.
- **Toda auditoria gravada durante o espelho herda `em_nome_de`** automaticamente, de
  `request.state`, sem cada serviço precisar lembrar.

Decisões da parte 1:

- **Suspender ONG cancela as atividades que ainda não começaram (RN-51), e reativar não
  as reabre.** O FS-05 dizia que "as atividades voltam", o que contradiz a RN-51 —
  cancelamento avisa e libera os inscritos, e não há como desfazer. As que já começaram
  ficam como estão (cancelar negaria o certificado de quem foi), saem da vitrine (RN-36) e
  podem ter a validação forçada.
- **Não há "editar e-mail" no console.** A4 previa corrigir o contato, mas trocar o e-mail
  e em seguida disparar a redefinição entregaria o link ao próprio admin, que entraria como
  a pessoa — exatamente o que a D12 proíbe. Correção de e-mail fica para um fluxo com
  confirmação no endereço novo.
- **Forçar validação aplica a política só a quem está sem decisão.** O que a ONG já tiver
  marcado é respeitado. A finalização reaproveita o mesmo caminho da ONG (`concluir`), com
  o admin como ator: a emissão continua atômica.
- **Editar como admin dispensa a trava da RN-12, não as de coerência.** Vagas abaixo dos
  inscritos, horário invertido e data no passado continuam barrados.
- **Leitura sensível é auditada** (RN-32): abrir o detalhe de alguém gera
  `usuario.consultado`; exportar a auditoria gera `auditoria.exportada`. Consultar a
  auditoria é registrado só na primeira página, para paginar não parecer nova consulta.
- **CSV da auditoria neutraliza fórmula.** Célula começando com `=`, `+`, `-` ou `@` vira
  fórmula ao abrir na planilha, e nomes e títulos vêm de qualquer usuário.
- **A RN-44 não chega a disparar pela API** — quem suspende é um admin ativo e não pode ser
  o alvo. A trava fica no serviço como defesa em profundidade, testada diretamente.
- **A CLI passou a auditar** `admin.criado` com `origem: cli` (FS-01).

---

### Fatia 9 — Portal institucional ✅

**Frontend:** `T1` a `T5` — início, como funciona, para estudantes, para ONGs, parceiras

Fica por último de propósito: é a camada mais visível, mas a que menos bloqueia as outras.

Entregue: `portal_service.py` e `routers/portal.py` (`/portal/resumo`, `/portal/ongs`,
`/portal/ongs/{id}`), 14 testes em `tests/test_portal.py`; no frontend, `PortalLayout`,
`components/portal/` e as páginas de `pages/portal/`, mais a vitrine pública em `/vagas`.
Verificado no navegador, inclusive em 375px: as oito páginas, o menu do celular e o
caminho "Quero participar" → cadastro com retorno para a vaga.

Decisões:

- **Número de vitrine sai do banco ou não aparece.** A página inicial antiga tinha
  "+120 vagas" fixo no código; saiu. Número zerado também some, e sem nenhum número a
  seção de impacto inteira não é desenhada. Certificado revogado não entra na conta.
- **T5 lista só ONG ativa que já publicou** (publicada ou finalizada). Conta recém-criada
  não aparece: vitrine de parceiras com cartão vazio não prova nada. Verificadas primeiro,
  depois quem mais realizou.
- **O perfil público da ONG é aberto a visitante, o do estudante não.** Da ONG saem nome,
  descrição, cidade, site, Instagram, logo e números; telefone, CNPJ e endereço ficam de
  fora — muita ONG pequena funciona na casa de alguém. `GET /usuarios/{id}/publico`
  continua exigindo login.
- **A vitrine pública reaproveita E2/E3** (`Vitrine` e `DetalheAtividade` recebem `base`).
  Para visitante, `BotaoInscricao` vira "Quero participar", que leva ao cadastro com o
  perfil de estudante e `?volta=` para a vaga; ONG e admin não veem botão.
- **`?volta=` só aceita caminho deste site** (`destinoSeguro`): sem isso, um link de
  login viraria redirecionamento para fora. O "Entrar" também passou a respeitar o destino
  que a `RotaPrivada` guarda.
- **"Ver uma verificação de exemplo" (T2) depende de configuração.**
  `CERTIFICADO_DEMONSTRACAO` aponta para um certificado de uma conta de teste; se estiver
  vazio, revogado ou não existir, o botão vira "Verificar um certificado". Escolher
  sozinho um certificado real para exibir exporia o nome de alguém sem pedir.
- **"Apenas com vaga" passou a filtrar no SQL.** Antes, as lotadas eram retiradas da
  página já montada, e total e paginação saíam errados.
- **Lacuna do plano: os painéis `E1` e `O1`** (`GET /painel/estudante` e `/painel/ong`,
  seção 11 do contrato) não estão em nenhuma fatia. `/painel` e `/ong` seguem com a tela
  provisória, que agora diz isso sem prometer fatia.

---

### Fatia 10 — Painéis de entrada ✅

**Backend:** `GET /painel/estudante` · `GET /painel/ong`
**Frontend:** `E1` e `O1`

Fatia que **não estava no plano original**: as duas telas de entrada estavam na
especificação e no contrato, mas nenhuma fatia as cobria. Até aqui, `/painel` e `/ong`
mostravam uma tela provisória.

Entregue: `painel_service.py`, `routers/painel.py`, 13 testes em `tests/test_painel.py`;
no frontend, `pages/estudante/Painel.jsx`, `pages/ong/Painel.jsx` e
`components/painel/`. A tela provisória `EmConstrucao` foi apagada.

Decisões:

- **Quem escolhe o destaque é o servidor.** A prioridade (check-in > evento de hoje >
  certificado novo > nada; e, na ONG, check-in > validar presenças > pedidos pendentes >
  rascunho parado) é regra de negócio. No navegador, cada tela reimplementaria a ordem — e
  elas divergiriam na primeira mudança.
- **"Certificado novo" é o aviso não lido.** O certificado não guarda leitura; a
  notificação `certificado.emitido` ainda não lida é a única marca honesta de "você ainda
  não viu isto".
- **Check-in já feito para de cobrar.** Com a presença registrada, o destaque vira
  "é hoje, sua presença já foi registrada" em vez de insistir no QR.
- **"Voluntários engajados" conta pessoas, não inscrições** (`confirmada` ou `presente`):
  quem voltou em três ações é um voluntário, não três. Pendente e cancelada não entram.
- **"Atividades no ar" = publicadas + acontecendo.** As duas são `publicada` no banco e se
  separam pelo relógio (RN-54); o que já terminou sai da conta e vira "aguardando
  validação".
- **A aba de `O2` passou a caber na URL** (`?aba=rascunho`): é assim que o destaque leva a
  ONG direto para a lista certa, e o endereço pode ser guardado.

---

## 4. Ordem e o ponto de virada

```
0 Fundação
 └─ 1 Acesso
     └─ 2 Perfil
         └─ 3 Atividades
             └─ 4 Inscrições
                 └─ 5 Check-in ⭐
                     └─ 6 Certificado ⭐  ← sistema demonstrável de ponta a ponta
                         ├─ 7 Notificações
                         ├─ 8 Console admin
                         └─ 9 Portal
```

**Da fatia 0 à 6 é o caminho crítico.** Concluídas essas sete, o projeto conta a história
inteira: ONG publica, aluno se inscreve, check-in por QR rotativo, certificado assinado e
verificação pública.

As fatias 7, 8 e 9 completam o produto, mas nenhuma é necessária para demonstrar a tese.
Se o prazo apertar, é por elas que se corta.

---

## 5. Definição de pronto

Uma fatia só está concluída quando:

1. Os endpoints respondem conforme [contrato-api.md](contrato-api.md)
2. As telas correspondentes funcionam, com estado vazio e erro tratados
3. Os fluxos da fatia foram percorridos, incluindo as exceções
4. Existem testes em pytest para as regras que **o banco não garante**
5. `npm run build` e `npm run lint` passam limpos
6. As ações da fatia aparecem na trilha de auditoria

---

## 6. O que acontece com o código atual

O backend de hoje é **substituído**, não adaptado. A cada fatia, o que ela cobre sai do
código antigo.

- ✅ `smoke_test.py` foi aposentado: o pytest cobre o mesmo terreno, por fatia
- O banco atual já foi zerado; as migrations novas nascem em base limpa
- ✅ O código antigo saiu inteiro do repositório, e `requisitos.md`, `api.md` e
  `backend-refactor.md` foram para [historico/](historico/), com aviso no topo. O
  `arquitetura.md` foi reescrito para o sistema de hoje

---

## 7. Sobre o e-mail (D39)

Em desenvolvimento, o link de redefinição é **escrito no terminal**, não enviado:

```
[email] Para: maria@email.com
[email] Redefinir senha: http://localhost:5173/redefinir-senha?token=...
```

O envio real fica atrás de uma interface só, trocada por variável de ambiente. A escolha do
provedor (Resend, Brevo ou SendGrid) acontece no deploy, sem tocar na regra de negócio.
