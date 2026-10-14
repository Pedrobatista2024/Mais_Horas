# Autenticação e sessão

Como o Mais Horas mantém alguém logado, e por que dessa forma.

## O modelo

Dois tokens com papéis diferentes, no padrão que o `djangorestframework-simplejwt`
popularizou — com as proteções extras que ele deixa a cargo de quem implementa.

| | Access token | Refresh token |
|---|---|---|
| **Formato** | JWT assinado (HS256) | String opaca de 64 caracteres |
| **Validade** | 15 minutos | 7 dias |
| **Onde fica no cliente** | Memória do JavaScript | Cookie `httpOnly` |
| **Guardado no servidor?** | Não (stateless) | Sim, como hash SHA-256 |
| **Dá para revogar?** | Não, só expira | Sim, a qualquer momento |
| **Vai em que requisição** | Todas, no header `Authorization` | Só em `/api/users/*` |

## Por que o access token não vai para o localStorage

Porque `localStorage` é legível por qualquer script que rode na página. Um único XSS —
uma dependência comprometida, um `dangerouslySetInnerHTML` descuidado — e o atacante lê a
sessão inteira e a leva embora.

Mantendo o access token só em memória e o refresh em cookie `httpOnly`, **não existe lugar
de onde o script possa ler a sessão**. O cookie o navegador envia sozinho; o JavaScript
nem enxerga que ele existe.

O preço é que um F5 apaga o access token da memória. Por isso o `AuthContext` chama
`/api/users/refresh` ao montar: o cookie ainda está lá, e a sessão volta sozinha.

## O fluxo

```
LOGIN
  cliente  ──  email + senha  ──>  API
                                    │  verifica senha (Argon2id)
                                    │  gera access (15min) + refresh (7d)
                                    │  grava SHA-256 do refresh no banco
  cliente  <──  access no corpo  ───┤
                refresh no cookie   │

USO NORMAL
  cliente  ──  Authorization: Bearer <access>  ──>  API

ACCESS EXPIROU (o interceptor do axios trata sozinho)
  cliente  ──  requisição  ──>  API  ──  401  ──>  cliente
  cliente  ──  POST /users/refresh (cookie)  ──>  API
                                                   │  valida, ROTACIONA
  cliente  <──  access novo + refresh novo  ────────┤
  cliente  ──  refaz a requisição original  ──>  API  ──  200
```

## Rotação e detecção de roubo

Todo uso do refresh token **queima o token usado e emite outro**. Um refresh nunca vale
duas vezes.

Isso permite detectar roubo. Cada login inicia uma **família** (`family_id`); todos os
tokens rotacionados a partir dele herdam essa família.

```
login  →  R1
R1 usado  →  R2   (R1 fica marcado como consumido)
R2 usado  →  R3
```

Se **R1 reaparecer** depois disso, só há duas explicações: ou alguém copiou o token, ou o
cliente legítimo mandou duas requisições ao mesmo tempo. O servidor distingue as duas pelo
tempo decorrido:

- **Até 15 segundos** depois do uso → corrida benigna. Emite um par novo e segue.
- **Depois disso** → tratado como roubo. **A família inteira é revogada**, e tanto o dono
  quanto o atacante precisam fazer login de novo.

### Por que a janela de graça existe

Sem ela, a rotação derruba usuários legítimos. Três situações provocam refresh concorrente:

- o **StrictMode do React** monta os efeitos duas vezes em desenvolvimento;
- o usuário tem **duas abas** abertas e as duas acordam juntas;
- um **retry de rede** reenvia a requisição que já tinha chegado.

Nos três casos o mesmo cookie chega duas vezes em milissegundos. Sem a janela, a segunda
chamada seria lida como ataque e mataria a sessão de quem não fez nada de errado — foi
exatamente o que aconteceu no primeiro teste desta implementação.

A janela não enfraquece a defesa de forma relevante: um atacante que roube o token teria
esses poucos segundos, e o uso seguinte — dele ou do dono — cai fora da janela e derruba
tudo.

O cliente também colabora: `refreshSession()` em `frontend/src/services/api.js` garante
**um único refresh em voo por vez**, compartilhado entre o `AuthContext` e o interceptor.

## Senhas

**Argon2id** para hashes novos — a recomendação atual da OWASP, resistente a ataque com
GPU de um jeito que bcrypt não é.

O backend antigo (Node) usava `bcryptjs`. Esses hashes continuam sendo aceitos, e no
primeiro login bem-sucedido a senha é **re-hasheada em Argon2id automaticamente**, já que
naquele instante ela está em claro na memória. Ninguém precisou trocar de senha na
migração.

```python
# app/core/security.py
if stored_hash.startswith(("$2a$", "$2b$", "$2y$")):
    return bcrypt.checkpw(...)   # hash legado do backend Node
return _ph.verify(stored_hash, password)   # Argon2id
```

## Mensagem de erro no login

Email inexistente e senha errada devolvem **a mesma mensagem** — "Email ou senha
incorretos".

O backend Node respondia "Usuário não encontrado" e "Senha incorreta" separadamente, o que
transformava a tela de login num verificador de cadastro: dá para descobrir quais emails
existem na base só pela diferença da resposta.

## Outras proteções

- **Rate limit**: 20 tentativas por IP a cada 15 minutos em `/auth/cadastro` e `/auth/entrar`.
  Considera `X-Forwarded-For`, senão no Render todo mundo compartilharia o IP do proxy.
- **Escopo do cookie**: `path=/api/v1/auth`, então o refresh não acompanha as demais chamadas.
- **CORS**: em produção a API **se recusa a subir** sem `CORS_ORIGIN` definido.
  `allow_credentials` fica ligado porque o cookie precisa atravessar origens.
- **Papéis na rota**: `Estudante`, `Ong` e `Admin` são declarados na assinatura do endpoint,
  não checado no meio da lógica — some a classe de bug de esquecer a verificação.

## Entrada por provedor externo (D41)

Google, Microsoft e GitHub. *Authorization code* com PKCE, tudo do lado do servidor e igual
para os três: o navegador nunca vê token de provedor. O código volta para a API, que o
troca, descobre quem é a pessoa e só então abre a sessão **normal** do Mais Horas — mesmo
access token, mesmo refresh em cookie.

| | Google | Microsoft | GitHub |
|---|---|---|---|
| Protocolo | OpenID Connect | OpenID Connect | **OAuth 2.0 puro** |
| A identidade vem de | `id_token` assinado | `id_token` assinado | API (`/user`, `/user/emails`) |
| `sub` guardado | `sub` | `sub` (único por app) | `id` numérico — o `login` muda |
| E-mail aceito quando | `email_verified` | conta pessoal, ou `xms_edov` verdadeiro | principal **e** verificado |
| Selo institucional | `hd` do Workspace | domínio do e-mail verificado | algum e-mail verificado no domínio |

- `state` e verificador PKCE viajam num cookie assinado (`mh_externo`, 10 minutos), que
  carrega também o provedor: a ida ao Google não fecha a volta da Microsoft.
- A identidade guardada é `(provedor, sub)`, em `identidades_externas`. O e-mail é copiado
  junto, mas **não** é chave.
- **E-mail verificado é obrigatório nos três**, e é isso que torna seguro vincular por
  e-mail: quem já tem conta — com senha ou por outro provedor — e entra com o mesmo e-mail
  ganha mais uma identidade na mesma conta, sem duplicar.
- **Microsoft e o "nOAuth".** Em conta de trabalho ou escola, o `email` do token é escrito
  pelo administrador do tenant e não é verificado: qualquer um que crie um tenant põe nele
  o e-mail de outra pessoa. Por isso ele só vale em conta pessoal (a Microsoft verificou no
  cadastro) ou com a claim opcional `xms_edov`, que diz que o domínio do e-mail pertence ao
  tenant. Fora disso, a entrada é recusada. O emissor é conferido contra o `tid` do próprio
  token, porque com `common` ele muda de tenant para tenant.
- **O GitHub não tem `id_token`.** Sem assinatura para conferir, a confiança vem de o token
  ter sido trocado por nós, servidor a servidor, com o nosso segredo, por HTTPS. O GitHub
  responde erro na troca com status `200`: é a falta do `access_token` que o denuncia.
- Conta nova não nasce no retorno: nenhum provedor sabe se a pessoa é estudante ou ONG. Os
  dados ficam num cookie assinado (`mh_externo_cadastro`, 15 minutos) até a escolha.
- Conta criada por aqui fica **sem senha**. O login por senha responde
  `credenciais_invalidas`, como para qualquer senha errada: dizer "esta conta é do Google"
  entregaria a estranhos como a pessoa entra.
- Cada provedor só existe com o seu par `*_CLIENT_ID` / `*_CLIENT_SECRET`. Sem ele, as rotas
  daquele provedor respondem `503` e o botão não aparece.

## Sessão espelho ("entrar como")

O admin pode ver o sistema como outra pessoa (D13), **sem nunca agir por ela**.

- `POST /admin/usuarios/{id}/entrar-como` devolve um access token do **alvo**, com as
  claims `espelho`, `adm` (o admin) e `sid` (uma linha de `tokens_sessao` com
  `em_nome_de`). Vale 30 minutos e **não tem refresh**.
- Toda requisição com esse token reconfere a linha, o admin e o alvo. Qualquer falha é
  `401 espelho_expirado`.
- Método que não seja `GET`/`HEAD`/`OPTIONS` é `403 modo_somente_leitura`, exceto
  `POST /admin/sair-do-modo`.
- No navegador, `definirEspelho(true)` troca o token em memória; o `usuario` do
  `localStorage` continua sendo o admin. Um 401 no espelho **não** chama `renovarSessao()`
  — dispara `mh:espelho-encerrado`, e só então a sessão do admin é restaurada pelo cookie.

## Limitações conhecidas

- O **rate limit é em memória, por processo**. Com mais de um worker o limite vira "20 por
  worker". O backend Node tinha exatamente a mesma limitação. Corrigir exige contador
  compartilhado (Redis).
- **Refresh tokens revogados não são limpos** da tabela. Não atrapalha nada hoje, mas em
  volume convém uma rotina periódica apagando o que já expirou.
