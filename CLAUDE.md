# CLAUDE.md

Instruções para agentes trabalhando neste repositório.

## O projeto

Mais Horas — plataforma que conecta estudantes e ONGs para horas de extensão, com
certificado validável por QR Code. Monorepo simples: `backend/` (FastAPI + Postgres) e
`frontend/` (React + Vite + Mantine).

O sistema foi **desenhado antes de ser codado**. A fonte da verdade é a documentação, não
o código: quando os dois discordarem, o código é que está atrasado.

| Antes de mexer em | Leia |
|---|---|
| qualquer coisa | [docs/plano-execucao.md](docs/plano-execucao.md) — o que já existe e o que vem |
| comportamento, tela, botão | [docs/especificacao.md](docs/especificacao.md) — 25 decisões, 56 regras, 27 telas |
| caminho de uso | [docs/fluxos.md](docs/fluxos.md) — 47 fluxos |
| tabela, coluna | [docs/modelo-dados.md](docs/modelo-dados.md) |
| endpoint | [docs/contrato-api.md](docs/contrato-api.md) |
| login, token, sessão | [docs/autenticacao.md](docs/autenticacao.md) |

## Estado atual

A construção é por **fatias verticais**: cada uma entrega backend, frontend e testes de um
pedaço que funciona ponta a ponta. Fatias 0 a 8 estão concluídas (fundação, acesso, perfil,
atividades, inscrições, presença, certificado, notificações,
console administrativo com "entrar como") — o ciclo inteiro já é demonstrável. As telas das fatias seguintes **ainda não estão roteadas** em `App.jsx`, de
propósito: chamariam endpoints que não existem, e tela quebrada é pior que tela ausente.

Restam no frontend alguns arquivos da versão anterior (Node/Express) em `pages/org/`,
`pages/student/` e `pages/public/` que ainda não foram migrados. Eles não estão roteados e
falam com uma API que não existe mais — não os use como referência de padrão. Cada fatia
apaga os que substitui.

## Comandos

```bash
docker compose up -d                          # Postgres local na porta 5433
cd backend && alembic upgrade head            # aplica migrations
cd backend && uvicorn app.main:app --reload --port 3000
cd backend && pytest -q                       # suíte completa
cd frontend && npm run dev                    # SPA em :5173
cd frontend && npm run build                  # precisa passar limpo antes de finalizar
cd frontend && npx eslint src                 # precisa passar sem erros
```

O backend usa venv em `backend/.venv`. Ative antes, ou chame o Python de lá direto.

Os testes usam um banco separado (`mais_horas_teste`), recriado no começo da sessão. Cada
teste roda numa transação revertida ao final, então a ordem não importa.

A sessão de teste usa `join_transaction_mode="create_savepoint"`: `commit()` vale até o fim
do teste e `rollback()` desfaz só o que não foi commitado, como em produção. Ao testar
atomicidade, **confira que o que deveria sobreviver sobreviveu** — "nada foi gravado" é
verdade também quando tudo foi apagado.

## Idioma

Código e documentação em **português**: nomes de variáveis, funções, comentários, mensagens
de erro da API e textos de interface. Nomes técnicos consagrados ficam em inglês
(`access_token`, `request`, `router`).

## Backend — padrões obrigatórios

O fluxo de toda requisição é fixo. Não pule etapas:

```
rota -> Depends(usuario_atual) -> Depends(exigir_papel) -> Pydantic -> service -> SQLAlchemy
```

1. **Validação sempre em `app/schemas/` com Pydantic**, declarada como type hint do
   endpoint. Nunca validar dentro do handler com `if not campo`.

2. **Autorização sempre na assinatura da rota**, via `Estudante` / `Ong` / `Admin` /
   `UsuarioAtual` de `app/core/deps.py`. Checagem de dono (ownership) fica em helper do
   service — foi exatamente a falta dela que criou a falha L2 registrada em
   [docs/requisitos.md](docs/requisitos.md).

3. **Routers são finos.** Recebem, chamam o service, respondem. Se um handler passou de
   ~20 linhas, a regra pertence a `app/services/`.

4. **Nunca `try/except` para virar resposta HTTP.** Lance `ErroDeNegocio` e deixe o handler
   central formatar:

   ```python
   raise ErroDeNegocio("nao_encontrado", "Atividade não encontrada",
                       status.HTTP_404_NOT_FOUND)
   ```

5. **Toda resposta de erro sai como `{ codigo, mensagem, detalhes? }`** — os handlers em
   `app/core/errors.py` cuidam disso, inclusive normalizando o 422 do FastAPI para
   `400 dados_invalidos`. O `422` fica reservado a erro semântico (`perfil_incompleto`).
   Não invente formatos novos.

6. **Toda listagem devolve `Pagina`** (`app/schemas/comum.py`): `itens`, `pagina`,
   `tamanho`, `total`, `paginas`. Um formato só, o frontend trata um só.

7. **Filtro é do servidor.** Não devolva a lista inteira para o navegador peneirar — nem
   quando o filtro depende de estado calculado.

8. **Aviso ao usuário passa por `notificacao_service`**, que também não dá commit e tem
   catálogo fechado. Texto novo mora lá, junto das regras de silêncio (recusa sem motivo,
   cancelamento sem o motivo da ONG).

9. **Toda ação relevante passa por `auditoria.registrar()`.** O catálogo de ações é
   fechado: ação fora dele levanta `ValueError` em vez de gravar lixo. `registrar()` não
   dá commit — entra na transação de quem chamou, então ou tudo grava ou nada grava.

10. **Nada de SQL cru.** Use SQLAlchemy. Se precisar de SQL literal numa migration, passe
   por `executar_script()` de `app/db/migration_utils.py` — o asyncpg recusa múltiplos
   comandos num prepared statement.

11. **Não adicione `print` de debug.**

## Frontend — padrões obrigatórios

**Antes de criar ou editar qualquer tela, leia a skill
[`.claude/skills/frontend-maishoras/SKILL.md`](.claude/skills/frontend-maishoras/SKILL.md).**
Ela tem a paleta, o catálogo de componentes e as regras de responsividade.

O resumo curto:

- **Sempre Mantine.** Sem Tailwind, sem HTML cru estilizado com `style` inline solto.
- **Reaproveite `src/components/`** antes de criar componente novo — `PageHeader`,
  `EmptyState`, `Loading`, `ConfirmarAcao`, `CartaoAtividade`, `SituacaoBadge`.
- **Erros da API com `mensagemDoErro(erro, padrão)`** de `services/api`, exibidos com
  `notifyError`. Nunca `alert()`.
- **Sempre trate `carregando` com `<Loading />`** e lista vazia com `<EmptyState />`.
- **Data pura (`"2026-09-20"`) só com `formatDate`/`formatDateLong`** de `utils/format`.
  `new Date()` direto lê como UTC e mostra o dia anterior no Brasil.
- **Constante exportada não mora em arquivo de componente** — quebra o recarregamento
  rápido do Vite. Veja `routes/destinos.js` e `components/atividade/situacoes.js`.
- **Responsivo é obrigatório** — a maioria dos alunos acessa por celular. Teste em 375px.

## Sessão — não quebre estas regras

Leia [docs/autenticacao.md](docs/autenticacao.md) antes de mexer em qualquer coisa de login.

- **O access token nunca vai para o `localStorage`.** Ele vive em memória, em
  `services/api.js`. Persistir o token desfaz a proteção contra XSS.
- **O refresh token nunca aparece no corpo da resposta.** Só no cookie `httpOnly`.
- **Só um refresh em voo por vez.** Use `renovarSessao()`, que compartilha a promessa.
  Chamar `/auth/renovar` direto, em paralelo, derrubava a sessão do usuário: o backend
  rotaciona e trata reapresentação como possível roubo. Há uma janela de tolerância de 15s
  no servidor para a corrida legítima — ela não substitui a promessa compartilhada.
- **`withCredentials: true`** é obrigatório no axios, senão o cookie não viaja.

## Banco de dados

Schema versionado com **Alembic** em `backend/alembic/versions/`. Dez tabelas, nomes em
português, restrições declaradas no banco e não só no código.

Invariantes que não podem ser quebradas:

- `inscricoes` é a fonte única de verdade da inscrição. Não crie array de participantes
  dentro de `atividades`.
- `UNIQUE(atividade_id, usuario_id)` em `inscricoes` — sem inscrição duplicada.
- `inscricao_id UNIQUE` em `certificados` — um certificado por inscrição.
- `certificados` copia nome, organização, título e data **no momento da emissão**. Não
  troque por JOIN: a assinatura Ed25519 cobre esse texto, e ler o valor atual invalidaria
  todo certificado antigo assim que uma ONG se renomeasse.
- `registros_auditoria` **não tem FK para `usuarios`**, de propósito: um CASCADE apagaria
  justamente a trilha do usuário sob investigação.
- O texto assinado do certificado (`texto_canonico_certificado`) cobre **todo campo que a
  verificação pública exibe**. Campo novo na página exige campo novo no texto — e versão
  nova (`MHC2`), porque mudar o formato invalida o que já foi emitido.
- `tokens_sessao` guarda **hash**, nunca o token em claro.
- O "entrar como" é **somente leitura** e isso é garantido em `core/deps.py`, não em cada
  rota: não crie exceção à recusa de escrita além de `/admin/sair-do-modo`. Leitura que
  entrega credencial (o QR de check-in) também é recusada no espelho.
- Os poderes do admin são limitados **pela ausência de rota**: não há como definir senha,
  trocar e-mail, emitir certificado nem alterar a auditoria. Não crie essas rotas.
- Atividade não finaliza com inscrição `pendente`.
- `UNIQUE(atividade_id, usuario_id)` significa que **reinscrever reaproveita a linha**.
  Não insira uma segunda: quem cancelou e voltou atrás tem a mesma inscrição reativada.
- Contagem de vaga em operação de escrita exige travar a linha da atividade
  (`with_for_update`). Contar sem travar deixa dois cliques simultâneos ocuparem a mesma
  última vaga.
- O token de check-in **não é gravado**: validar é recalcular a partir de
  `(atividade, segredo, janela de 30 s)`. Não crie tabela de tokens emitidos.
- Check-in é **evidência, não decisão** (RN-23). Ele nunca muda a situação da inscrição
  por conta própria; quem define presença é a ONG, e a divergência entre os dois é
  justamente o que se quer poder auditar.
- Situação de atividade **não tem processo em segundo plano**. `em_andamento` e
  `aguardando_validacao` são calculadas na leitura, comparando data e hora com o relógio.
  Não crie scheduler para isso.

## Antes de finalizar

- `cd backend && pytest -q` — tudo verde.
- `cd frontend && npm run build && npx eslint src` — ambos limpos.
- Verifique no navegador o que dá para verificar.

## Documentação

Ao mudar algo estrutural, atualize o doc correspondente:

| Mudou | Atualize |
|---|---|
| Fatia entregue, decisão de implementação | [docs/plano-execucao.md](docs/plano-execucao.md) |
| Comportamento novo, tela, botão, estado | [docs/especificacao.md](docs/especificacao.md) |
| Caminho de uso, erro tratado, cenário | [docs/fluxos.md](docs/fluxos.md) |
| Tabela, coluna, restrição, índice | [docs/modelo-dados.md](docs/modelo-dados.md) |
| Endpoint, payload, código de erro | [docs/contrato-api.md](docs/contrato-api.md) |
| Pastas, componentes, rotas de tela | [docs/arquitetura.md](docs/arquitetura.md) |
| Login, token, sessão | [docs/autenticacao.md](docs/autenticacao.md) |
| Env, build, deploy | [docs/deploy.md](docs/deploy.md) |
| Estratégia de certificado ou presença | [docs/desafio-tecnico.md](docs/desafio-tecnico.md) |

`docs/api.md` e `docs/backend-refactor.md` são **históricos** — descrevem o backend
anterior ao redesenho. Quem manda hoje é `contrato-api.md`.

## Dívida técnica conhecida

- Uploads gravados em disco local. No servidor próprio ficam num volume e persistem; num
  serviço efêmero (Render) somem a cada deploy.
- Rate limit em memória, por processo: não vale para mais de uma instância.
- E-mail em modo console; não há envio real configurado.
- Telas da versão anterior ainda não migradas, descritas em "Estado atual".
