# Deploy — Mais Horas

Há dois caminhos. **O oficial é o servidor próprio** (VM na Azure, com os créditos de
estudante): não dorme, não perde uploads e serve site e API no mesmo endereço. O
[`render.yaml`](../render.yaml) continua como alternativa gratuita, descrita mais abaixo.

## Servidor próprio (Docker + Caddy)

Tudo mora em [`deploy/`](../deploy):

| Arquivo | Papel |
|---|---|
| `docker-compose.yml` | Postgres, API e Caddy. O banco não expõe porta |
| `Caddyfile` | HTTPS automático, entrega o site e repassa `/api`, `/uploads` e `/saude` |
| `instalar.sh` | Prepara o Ubuntu (Docker, swap, cron), gera os segredos e sobe |
| `publicar.sh` | Publica um commit do `main` — único comando da chave do pipeline |
| `atualizar.sh` | `git pull` + rebuild, para publicar na mão |
| `backup.sh` | `pg_dump` diário em `~/backups`, guardando 14 dias |
| `.env.exemplo` | Modelo do `deploy/.env` (este nunca vai para o git) |

Imagens: `backend/Dockerfile` (Python 3.12, sem root, um worker, migrations na subida) e
`frontend/Dockerfile` (build do Vite servido pelo Caddy).

**Por que um endereço só:** com site e API no mesmo domínio, o cookie de renovação é
"do próprio site". Em domínios diferentes ele vira cookie de terceiros, que o Safari
bloqueia — a sessão cairia a cada 15 minutos.

### A máquina

- Azure for Students: as regiões liberadas são limitadas por política da assinatura
  (`eastus`, `eastus2`, `northcentralus`, `canadacentral`, `mexicocentral`) e muitos
  tamanhos ficam indisponíveis. Usamos **B2als_v2** (2 vCPU, 4 GB, ~US$ 27/mês) em
  **North Central US**, Ubuntu 24.04 x64, disco Premium SSD 64 GB, portas 22/80/443.
- No IP público, defina um **rótulo DNS** (Configuração → Rótulo do nome DNS). O endereço
  vira `<rotulo>.northcentralus.cloudapp.azure.com`, e é com ele que o Caddy tira o
  certificado. HTTPS é obrigatório: sem ele o navegador não libera a câmera do check-in
  e o cookie `Secure` não viaja.
- Crie um orçamento na assinatura com aviso por e-mail. O crédito expira em 18/06/2027.

### Primeira instalação

```bash
ssh -i maishoras_key.pem maishoras@<endereco>
git clone https://github.com/Pedrobatista2024/Mais_Horas.git
cd Mais_Horas
./deploy/instalar.sh <endereco>
cd deploy && sudo docker compose exec api python -m app.cli criar-admin
```

`instalar.sh` pode ser rodado de novo: mantém swap, `.env` e chave existentes.

> **Copie `deploy/.env` para fora do servidor** logo após instalar. Ele tem a
> `CHAVE_ASSINATURA`: perdê-la invalida todo certificado emitido, e trocá-la também.

### Publicação automática

**Todo push no `main` passa pelo pipeline e, com os testes verdes, entra no ar.**

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

1. `backend` — pytest com Postgres de serviço;
2. `frontend` — lint e build;
3. `deploy` — só em push no `main` e só se os dois passaram. Entra na VM por SSH e
   manda o SHA testado; em seguida confere `/saude`. Aparece no GitHub como ambiente
   `producao`, com o link do site.

Push novo cancela o pipeline anterior ainda em andamento: o mais recente é que publica.

**A chave do pipeline só sabe fazer uma coisa.** Em `~/.ssh/authorized_keys` da VM ela
está como `command="…/deploy/publicar.sh",restrict`: sem shell, sem túnel, e o que o
pipeline envia vira só o argumento. [`publicar.sh`](../deploy/publicar.sh) aceita um SHA
de 40 caracteres, confere que ele está no `main`, avança até ele e recompila. Vazar o
segredo permite, no pior caso, republicar um commit que já está no `main`.

A identidade da VM (chave de host) está fixada no workflow: se a VM for recriada,
atualize com `ssh-keyscan -t ed25519 <endereco>`.

Para (re)criar a chave de deploy:

```bash
ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f deploy_gh
# na VM, uma linha em ~/.ssh/authorized_keys:
#   command="/home/maishoras/Mais_Horas/deploy/publicar.sh",restrict <conteúdo de deploy_gh.pub>
gh secret set DEPLOY_SSH_KEY < deploy_gh
rm deploy_gh deploy_gh.pub
```

Publicar na mão, sem pipeline: `~/Mais_Horas/deploy/atualizar.sh` na VM.

### Operar

```bash
cd ~/Mais_Horas/deploy && sudo docker compose logs -f api
sudo docker compose exec -T banco pg_restore -U maishoras -d mais_horas --clean < ~/backups/<arquivo>.dump
```

Leve os backups para fora da VM de vez em quando (`scp`): backup no mesmo disco não
protege contra perder a máquina.

## Render (alternativa)

O `render.yaml` é um blueprint que provisiona os três serviços de uma vez: banco
Postgres, API Python e site estático. No plano gratuito a API dorme após inatividade e
leva perto de um minuto para acordar.

### Serviços provisionados

| Serviço | Tipo | Diretório | Comando |
|---|---|---|---|
| `mais-horas-db` | PostgreSQL (free) | — | — |
| `mais-horas-api` | Web / Python (free) | `backend` | `pip install -r requirements.txt && alembic upgrade head` → `uvicorn` |
| `mais-horas-web` | Static site (free) | `frontend` | `npm install && npm run build` → `./dist` |

O site estático usa rewrite de `/*` para `/index.html`, necessário para o roteamento
client-side do React Router funcionar em links diretos (ex.: alguém abrindo
`/verificar/ABC123` direto do QR Code).

### Passo a passo

1. Suba o repositório no GitHub.
2. No Render: **New** → **Blueprint** → selecione o `render.yaml`.
3. Aguarde o primeiro deploy. Ele vai falhar parcialmente até as envs serem preenchidas —
   é esperado.
4. Preencha as variáveis marcadas `sync: false`:

   Em **`mais-horas-api`**:
   - `APP_URL` — a URL pública da própria API (ex.: `https://mais-horas-api.onrender.com`)
   - `WEB_URL` — a URL do site (usada para montar o link dentro do QR Code do certificado)
   - `CORS_ORIGIN` — a URL do site (aceita várias, separadas por vírgula)

   Em **`mais-horas-web`**:
   - `VITE_API_URL` — a URL da API, **sem barra no final**

5. Faça redeploy do frontend. O Vite injeta `VITE_API_URL` no momento do build, então
   mudar a env sem rebuildar não tem efeito.

## Variáveis de ambiente

### Backend

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | String de conexão do Postgres. No Render vem automática do `mais-horas-db` |
| `JWT_SECRET` | sim | Secret de assinatura do JWT. **O servidor aborta o boot se faltar.** No Render é gerada automaticamente |
| `AMBIENTE` | em produção | `producao` liga cookie `Secure`, `SameSite=None`, HSTS e as travas de boot abaixo. **Sem ela o servidor roda em modo desenvolvimento** |
| `CHECKIN_SECRET` | sim | Segredo do QR de check-in. **O servidor aborta o boot se faltar.** No Render é gerado automaticamente |
| `CHAVE_ASSINATURA` | **sim em produção** | Chave Ed25519 dos certificados (`python -m app.cli gerar-chave`). Com `AMBIENTE=producao` a API **se recusa a subir** sem ela. **Nunca troque** depois de emitir: invalida todos os certificados |
| `ACCESS_TOKEN_MINUTOS` | não | Padrão `15` |
| `REFRESH_TOKEN_DIAS` | não | Padrão `7` |
| `EMAIL_MODO` | não | Padrão `console` (escreve no log) |
| `APP_URL` | sim | URL pública da API |
| `WEB_URL` | sim | URL pública do site — vira o destino do QR Code |
| `CORS_ORIGIN` | **sim em produção** | Origens permitidas, separadas por vírgula. Com `AMBIENTE=producao` a API **se recusa a subir** sem esta variável |
| `PGSSL` | não | SSL na conexão com o banco. Sem valor, segue o ambiente (produção liga). O servidor próprio usa `false`: o banco está na rede interna do Docker |
| `PORT` | não | Padrão `3000` |

### Frontend

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | sim | URL base da API, sem barra no final |

Modelos completos em [`backend/.env.example`](../backend/.env.example) e
[`frontend/.env.example`](../frontend/.env.example).

## O banco

O schema é versionado com **Alembic**. O `buildCommand` do Render roda
`alembic upgrade head` antes de subir a aplicação, então o deploy aplica as migrations
pendentes sozinho.

A migration `0001` usa `CREATE TABLE IF NOT EXISTS`, espelhando exatamente o schema que o
backend Node criava. Isso faz o mesmo comando funcionar em banco novo e em banco que já
rodou a versão anterior — não é preciso `alembic stamp` manual.

**Migrar um ambiente que já rodava o backend Node:** nada além de `alembic upgrade head`.
As tabelas existentes ficam intactas, só a `refresh_tokens` é adicionada. Os usuários
mantêm as senhas — os hashes bcrypt continuam sendo aceitos e são convertidos para
Argon2id no primeiro login. Ver [autenticacao.md](autenticacao.md).

## Limitação conhecida: uploads

O disco do plano free do Render é **efêmero**. As fotos de perfil são gravadas em
`backend/uploads/` e **somem a cada redeploy**.

Em desenvolvimento isso não incomoda. Para produção de verdade, a correção é trocar a
gravação em disco por um storage externo (Cloudinary, S3 ou R2) em
`backend/app/services/user_service.py`. Está registrado como dívida técnica em
[backend-refactor.md](backend-refactor.md).

> As fotos em `backend/uploads/` **não são versionadas**. Houve um período em que ficaram
> no git por acidente — um padrão errado no `.gitignore` — mas eram imagens órfãs da versão
> em MongoDB, sem nenhum usuário apontando para elas, e foram removidas.

## Nota sobre o plano free

Serviços free do Render hibernam após inatividade. A primeira requisição depois de um
período parado pode levar ~30 segundos para responder enquanto o serviço acorda.
Vale saber disso antes de uma demonstração ao vivo — abra a aplicação alguns minutos antes.
