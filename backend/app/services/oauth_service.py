"""
Entrada por provedor externo: Google, Microsoft e GitHub (D41).

Fluxo: *authorization code* com PKCE, igual para os três. O navegador nunca vê
token de provedor nenhum — o código volta para a nossa API, que o troca do lado
do servidor, descobre quem é a pessoa e só então abre a sessão normal do Mais
Horas. Do ponto de vista do resto do sistema, nada muda: sai o mesmo par access
token + refresh em cookie.

Onde os provedores diferem é em **como a identidade chega**:

- **Google e Microsoft falam OpenID Connect.** A identidade vem num `id_token`
  assinado, e a assinatura é conferida contra as chaves públicas de cada um.
- **O GitHub fala só OAuth 2.0.** Não existe `id_token`: volta um token de
  acesso, e quem a pessoa é se descobre perguntando à API do GitHub com ele. A
  confiança vem de a troca ter sido feita por nós, servidor a servidor, com o
  nosso segredo, por HTTPS.

Duas travas valem para os três:

- **A identidade é (provedor, `sub`), não o e-mail.** O `sub` não muda; o
  e-mail pode ser trocado, e num domínio institucional até reatribuído.
- **O e-mail precisa vir verificado pelo provedor.** Sem isso, quem criasse uma
  conta com o e-mail de outra pessoa assumiria a conta dela aqui. Cada provedor
  diz isso de um jeito — e a Microsoft, por padrão, não diz
  (ver `identidade_microsoft`).
"""

from __future__ import annotations

import base64
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import auditoria
from app.core.config import config
from app.core.errors import ErroDeNegocio
from app.db.models import IdentidadeExterna, PerfilEstudante, PerfilOng, Usuario
from app.services import auth_service

# O estado da ida ao provedor vive num cookie curto: guardá-lo no banco criaria
# uma tabela de lixo que ninguém limpa.
MINUTOS_DE_IDA = 10
MINUTOS_DE_CADASTRO = 15

EMISSORES_GOOGLE = ("https://accounts.google.com", "accounts.google.com")
# Tenant fixo das contas pessoais da Microsoft (Outlook, Hotmail, Live).
TENANT_PESSOAL_MICROSOFT = "9188040d-6c67-4c5b-b112-36a304b66dad"
API_GITHUB = "https://api.github.com"


@dataclass(frozen=True)
class Provedor:
    chave: str
    nome: str
    artigo: str            # "o Google", "a Microsoft": vai para as mensagens
    autorizacao: str
    troca: str
    escopo: str
    chaves_publicas: str | None = None   # JWKS — só quem fala OpenID Connect
    extras: dict[str, str] = field(default_factory=dict)

    @property
    def client_id(self) -> str:
        return getattr(config, f"{self.chave}_client_id")

    @property
    def client_secret(self) -> str:
        return getattr(config, f"{self.chave}_client_secret")

    @property
    def disponivel(self) -> bool:
        return bool(self.client_id and self.client_secret)

    @property
    def pelo(self) -> str:
        return f"{'pela' if self.artigo == 'a' else 'pelo'} {self.nome}"

    @property
    def sujeito(self) -> str:
        return f"{self.artigo.upper()} {self.nome}"

    def url(self, modelo: str) -> str:
        # Só a Microsoft tem `{tenant}` na URL; nas outras o format não muda nada.
        return modelo.format(tenant=config.microsoft_tenant or "common")


PROVEDORES: dict[str, Provedor] = {
    "google": Provedor(
        chave="google", nome="Google", artigo="o",
        autorizacao="https://accounts.google.com/o/oauth2/v2/auth",
        troca="https://oauth2.googleapis.com/token",
        escopo="openid email profile",
        chaves_publicas="https://www.googleapis.com/oauth2/v3/certs",
        extras={"prompt": "select_account"}),
    # `common` aceita conta pessoal e conta de trabalho ou escola: é como o
    # aluno da UniC (Microsoft 365) e a ONG (Microsoft para ONGs) entram.
    "microsoft": Provedor(
        chave="microsoft", nome="Microsoft", artigo="a",
        autorizacao="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
        troca="https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        escopo="openid email profile",
        chaves_publicas="https://login.microsoftonline.com/common/discovery/v2.0/keys",
        extras={"prompt": "select_account"}),
    "github": Provedor(
        chave="github", nome="GitHub", artigo="o",
        autorizacao="https://github.com/login/oauth/authorize",
        troca="https://github.com/login/oauth/access_token",
        escopo="read:user user:email"),
}


@dataclass
class Identidade:
    """O que o provedor afirma sobre quem entrou — já conferido."""

    provedor: str
    sub: str
    email: str
    nome: str
    # Domínio institucional comprovado pelo provedor, quando há: o `hd` do
    # Google, o domínio verificado da Microsoft, o e-mail verificado no GitHub.
    dominio: str | None


def provedor(chave: str) -> Provedor:
    encontrado = PROVEDORES.get(chave)
    if encontrado is None:
        raise ErroDeNegocio("nao_encontrado", "Provedor de entrada desconhecido",
                            status.HTTP_404_NOT_FOUND)
    return encontrado


def disponiveis() -> dict[str, bool]:
    """Quais entradas este servidor oferece. Sem credencial, sem botão."""
    return {chave: p.disponivel for chave, p in PROVEDORES.items()}


def _exigir_configuracao(p: Provedor) -> None:
    if not p.disponivel:
        raise ErroDeNegocio(
            "externo_indisponivel",
            f"A entrada {p.pelo} não está configurada neste servidor",
            status.HTTP_503_SERVICE_UNAVAILABLE)


def _expirou(p: Provedor) -> ErroDeNegocio:
    return ErroDeNegocio("externo_estado_invalido",
                         f"A entrada {p.pelo} expirou. Tente de novo",
                         status.HTTP_400_BAD_REQUEST)


def _recusou(p: Provedor, mensagem: str | None = None) -> ErroDeNegocio:
    return ErroDeNegocio(
        "externo_recusou",
        mensagem or f"{p.sujeito} não confirmou esta entrada. Tente de novo",
        status.HTTP_400_BAD_REQUEST)


def _email_nao_verificado(p: Provedor) -> ErroDeNegocio:
    return ErroDeNegocio(
        "externo_email_nao_verificado",
        f"{p.sujeito} não confirmou o e-mail desta conta, então não dá para "
        "entrar por ela",
        status.HTTP_400_BAD_REQUEST)


def _url_de_retorno(p: Provedor) -> str:
    return f"{config.app_url.rstrip('/')}/api/v1/auth/{p.chave}/retorno"


def _assinar(dados: dict, minutos: int) -> str:
    """Estado e cadastro pendente viajam em JWT nosso, dentro de cookie."""
    agora = datetime.now(timezone.utc)
    return jwt.encode({**dados, "iat": agora,
                       "exp": agora + timedelta(minutes=minutos)},
                      config.jwt_secret, algorithm=config.jwt_algoritmo)


def _ler(token: str | None, campos: tuple[str, ...], p: Provedor) -> dict:
    if not token:
        raise _expirou(p)
    try:
        dados = jwt.decode(token, config.jwt_secret,
                           algorithms=[config.jwt_algoritmo])
    except jwt.PyJWTError as erro:
        raise _expirou(p) from erro
    if any(campo not in dados for campo in campos):
        raise _expirou(p)
    # O cookie de uma ida ao Google não serve para concluir uma volta da
    # Microsoft: cada fluxo só fecha com o provedor em que começou.
    if dados["provedor"] != p.chave:
        raise _expirou(p)
    return dados


def _cru(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).decode().rstrip("=")


def comecar(p: Provedor) -> tuple[str, str]:
    """
    Devolve (url do provedor, cookie de estado).

    O `state` protege contra CSRF e o PKCE contra o código ser interceptado e
    trocado por outra pessoa — os dois viajam no cookie, que o atacante não
    consegue forjar.
    """
    _exigir_configuracao(p)
    verificador = secrets.token_urlsafe(64)
    desafio = _cru(sha256(verificador.encode()).digest())
    estado = secrets.token_urlsafe(24)

    url = f"{p.url(p.autorizacao)}?" + urlencode({
        "client_id": p.client_id,
        "redirect_uri": _url_de_retorno(p),
        "response_type": "code",
        "scope": p.escopo,
        "state": estado,
        "code_challenge": desafio,
        "code_challenge_method": "S256",
        **p.extras,
    })
    return url, _assinar({"provedor": p.chave, "estado": estado,
                          "verificador": verificador}, MINUTOS_DE_IDA)


def ler_ida(cookie: str | None, estado_recebido: str, p: Provedor) -> dict:
    """
    Confere o `state` que voltou do provedor contra o que guardamos.

    É o que impede alguém de induzir a vítima a completar um login com a conta
    do atacante (CSRF de login): sem o cookie desta máquina, o retorno não vale.
    """
    dados = _ler(cookie, ("provedor", "estado", "verificador"), p)
    if not secrets.compare_digest(dados["estado"], estado_recebido or ""):
        raise _expirou(p)
    return dados


# ===================== Troca do código pela identidade =====================


async def identidade_do_codigo(p: Provedor, codigo: str,
                               verificador: str) -> Identidade:
    """Troca o código pelo token, do lado do servidor, e lê quem entrou."""
    async with httpx.AsyncClient(timeout=15) as http:
        resposta = await http.post(
            p.url(p.troca),
            data={
                "code": codigo,
                "client_id": p.client_id,
                "client_secret": p.client_secret,
                "redirect_uri": _url_de_retorno(p),
                "grant_type": "authorization_code",
                "code_verifier": verificador,
            },
            # O GitHub responde em formulário se não pedirmos JSON.
            headers={"Accept": "application/json"})
        if resposta.status_code != 200:
            raise _recusou(p)
        corpo = resposta.json()

        if p.chave == "github":
            # Erro do GitHub também vem com status 200, só que sem o token.
            token = corpo.get("access_token")
            if not token:
                raise _recusou(p)
            usuario, emails = await _perguntar_ao_github(http, token, p)
            return identidade_github(usuario, emails)

    bruto = corpo.get("id_token")
    if not bruto:
        raise _recusou(p)
    claims = _conferir_assinatura(p, bruto)
    if p.chave == "microsoft":
        return identidade_microsoft(claims)
    return identidade_google(claims)


async def _perguntar_ao_github(http: httpx.AsyncClient, token: str,
                               p: Provedor) -> tuple[dict, list[dict]]:
    cabecalhos = {"Authorization": f"Bearer {token}",
                  "Accept": "application/vnd.github+json",
                  "X-GitHub-Api-Version": "2022-11-28",
                  "User-Agent": "Mais-Horas"}
    usuario = await http.get(f"{API_GITHUB}/user", headers=cabecalhos)
    emails = await http.get(f"{API_GITHUB}/user/emails", headers=cabecalhos)
    if usuario.status_code != 200 or emails.status_code != 200:
        raise _recusou(p)
    return usuario.json(), emails.json()


# Um cliente por endereço de chaves: o PyJWKClient guarda as chaves em cache,
# e recriá-lo a cada entrada buscaria tudo de novo toda vez.
_clientes_de_chaves: dict[str, jwt.PyJWKClient] = {}


def _conferir_assinatura(p: Provedor, bruto: str) -> dict:
    """
    Valida o `id_token` contra as chaves públicas do provedor.

    Aceitar o token sem conferir a assinatura seria aceitar qualquer JSON que
    alguém colasse aqui dizendo ser de quem quisesse. O emissor é conferido
    depois, por provedor, porque cada um o escreve de um jeito.
    """
    try:
        chaves = _clientes_de_chaves.setdefault(
            p.chaves_publicas, jwt.PyJWKClient(p.chaves_publicas))
        chave = chaves.get_signing_key_from_jwt(bruto)
        return jwt.decode(bruto, chave.key, algorithms=["RS256"],
                          audience=p.client_id)
    except jwt.PyJWTError as erro:
        raise _recusou(p, f"Não consegui validar a resposta d{p.artigo} {p.nome}") from erro


def _nome(claims_ou_usuario: dict, email: str, *campos: str) -> str:
    for campo in campos:
        if claims_ou_usuario.get(campo):
            return str(claims_ou_usuario[campo])[:120]
    return email.split("@")[0]


def identidade_google(claims: dict) -> Identidade:
    p = PROVEDORES["google"]
    if claims.get("iss") not in EMISSORES_GOOGLE:
        raise _recusou(p, "Resposta do Google inesperada")
    email = str(claims.get("email") or "").strip().lower()
    if not email or not claims.get("email_verified"):
        raise _email_nao_verificado(p)
    return Identidade(provedor="google", sub=str(claims["sub"]), email=email,
                      nome=_nome(claims, email, "name"), dominio=claims.get("hd"))


def _verdadeiro(valor: object) -> bool:
    # Claim opcional da Microsoft pode chegar como booleano ou como texto.
    return valor is True or str(valor).lower() in ("true", "1")


def identidade_microsoft(claims: dict) -> Identidade:
    """
    O cuidado aqui é o e-mail.

    Numa conta de trabalho ou escola, o campo `email` é editável pelo
    administrador do tenant e **não** é verificado: qualquer um que crie um
    tenant pode pôr nele o e-mail de outra pessoa. Foi assim que surgiu a falha
    conhecida como "nOAuth", em sites que usavam esse campo para vincular
    contas. Por isso o e-mail só vale quando:

    - a conta é **pessoal** (Outlook, Hotmail): a Microsoft verificou o e-mail
      no cadastro; ou
    - o token traz `xms_edov` verdadeiro: o dono do domínio do e-mail foi
      verificado pelo tenant. É uma claim opcional, que precisa ser ligada no
      registro do app (docs/deploy.md).

    Fora isso, a entrada é recusada em vez de arriscar.
    """
    p = PROVEDORES["microsoft"]
    tid = str(claims.get("tid") or "")
    # Com `common`, o emissor muda de tenant para tenant; o certo é ele bater
    # com o tenant que o próprio token declara.
    if not tid or claims.get("iss") != f"https://login.microsoftonline.com/{tid}/v2.0":
        raise _recusou(p, "Resposta da Microsoft inesperada")

    email = str(claims.get("email") or "").strip().lower()
    pessoal = tid == TENANT_PESSOAL_MICROSOFT
    if not email or "@" not in email or not (pessoal or _verdadeiro(claims.get("xms_edov"))):
        raise _email_nao_verificado(p)

    return Identidade(provedor="microsoft", sub=str(claims["sub"]), email=email,
                      nome=_nome(claims, email, "name"),
                      dominio=None if pessoal else email.split("@")[1])


def identidade_github(usuario: dict, emails: list[dict]) -> Identidade:
    """
    Sem `id_token`, a identidade vem da API: `/user` diz quem é, e
    `/user/emails` diz quais e-mails o GitHub confirmou.

    O `login` (nome de usuário) pode ser trocado; o `id` numérico não. A conta
    entra pelo e-mail **principal e verificado**, e ganha o selo institucional
    se tiver qualquer e-mail verificado no domínio da instituição — o GitHub só
    marca como verificado quem clicou no link enviado àquela caixa.
    """
    p = PROVEDORES["github"]
    if not usuario.get("id"):
        raise _recusou(p)

    verificados = [str(e["email"]).strip().lower() for e in emails
                   if e.get("verified") and e.get("email")]
    principal = next((str(e["email"]).strip().lower() for e in emails
                      if e.get("primary") and e.get("verified") and e.get("email")),
                     None)
    if principal is None:
        raise _email_nao_verificado(p)

    alvo = config.dominio_institucional.strip().lower()
    institucional = bool(alvo) and any(e.endswith(f"@{alvo}") for e in verificados)

    return Identidade(provedor="github", sub=str(usuario["id"]), email=principal,
                      nome=_nome(usuario, principal, "name", "login"),
                      dominio=alvo if institucional else None)


# ===================== Entrada =====================


async def entrar(
    sessao: AsyncSession, identidade: Identidade, *, request: Request | None = None
) -> auth_service.Sessao | str:
    """
    Abre a sessão de quem já é conhecido, ou devolve um **cadastro pendente**.

    A conta nova não é criada aqui: falta escolher o papel, e criar antes disso
    deixaria contas sem dono definido se a pessoa desistisse na tela seguinte.
    """
    registro = await sessao.scalar(
        select(IdentidadeExterna).where(
            IdentidadeExterna.provedor == identidade.provedor,
            IdentidadeExterna.sub == identidade.sub))

    usuario = None
    if registro is not None:
        usuario = await sessao.get(Usuario, registro.usuario_id)
    else:
        # Mesmo e-mail, já cadastrado — com senha ou por outro provedor: é a
        # mesma pessoa, e o provedor acabou de provar que o e-mail é dela.
        # Vincula em vez de recusar. Só é seguro porque nenhum provedor passa
        # daqui com e-mail não verificado.
        usuario = await sessao.scalar(
            select(Usuario).where(Usuario.email == identidade.email))

    if usuario is None:
        return _assinar({"provedor": identidade.provedor, "sub": identidade.sub,
                         "email": identidade.email, "nome": identidade.nome,
                         "dominio": identidade.dominio or ""},
                        MINUTOS_DE_CADASTRO)

    if usuario.situacao != "ativa":
        raise ErroDeNegocio("conta_suspensa",
                            "Esta conta está suspensa. Procure a administração",
                            status.HTTP_403_FORBIDDEN)

    if registro is None:
        sessao.add(IdentidadeExterna(
            usuario_id=usuario.id, provedor=identidade.provedor, sub=identidade.sub,
            email=identidade.email, dominio=identidade.dominio,
            ultimo_acesso_em=datetime.now(timezone.utc)))
        await auditoria.registrar(
            sessao, f"conta.vinculada_{identidade.provedor}", ator_id=usuario.id,
            ator_papel=usuario.papel, entidade="usuario", entidade_id=usuario.id,
            depois={"dominio": identidade.dominio}, request=request)
    else:
        registro.ultimo_acesso_em = datetime.now(timezone.utc)
        registro.email = identidade.email
        registro.dominio = identidade.dominio

    resultado = await auth_service.abrir_sessao(sessao, usuario, request=request)
    await auditoria.registrar(
        sessao, "sessao.iniciada", ator_id=usuario.id, ator_papel=usuario.papel,
        entidade="usuario", entidade_id=usuario.id,
        depois={"origem": identidade.provedor}, request=request)
    await sessao.commit()
    await sessao.refresh(usuario)
    return resultado


async def concluir_cadastro(
    sessao: AsyncSession, pendente: str | None, p: Provedor, papel: str, *,
    request: Request | None = None,
) -> auth_service.Sessao:
    """Cria a conta depois de a pessoa escolher o papel."""
    dados = _ler(pendente, ("provedor", "sub", "email", "nome"), p)
    if papel not in ("estudante", "ong"):
        raise ErroDeNegocio("dados_invalidos", "Escolha estudante ou ONG")

    ja_existe = await sessao.scalar(
        select(IdentidadeExterna).where(IdentidadeExterna.provedor == p.chave,
                                        IdentidadeExterna.sub == dados["sub"]))
    # O e-mail pode ter ganhado conta nos 15 minutos em que a pessoa escolhia
    # o perfil. Entrar de novo cai no vínculo por e-mail, sem duplicar.
    mesmo_email = await sessao.scalar(
        select(Usuario.id).where(Usuario.email == dados["email"]))
    if ja_existe is not None or mesmo_email is not None:
        raise ErroDeNegocio("conta_ja_criada",
                            f"Esta conta já está cadastrada. Entre {p.pelo} de novo",
                            status.HTTP_409_CONFLICT)

    usuario = Usuario(nome=dados["nome"][:120], email=dados["email"],
                      senha_hash=None, papel=papel)
    sessao.add(usuario)
    await sessao.flush()
    sessao.add(PerfilEstudante(usuario_id=usuario.id) if papel == "estudante"
               else PerfilOng(usuario_id=usuario.id))
    sessao.add(IdentidadeExterna(
        usuario_id=usuario.id, provedor=p.chave, sub=dados["sub"],
        email=dados["email"], dominio=dados.get("dominio") or None,
        ultimo_acesso_em=datetime.now(timezone.utc)))

    resultado = await auth_service.abrir_sessao(sessao, usuario, request=request)
    await auditoria.registrar(
        sessao, "conta.criada", ator_id=usuario.id, ator_papel=papel,
        entidade="usuario", entidade_id=usuario.id,
        depois={"origem": p.chave, "dominio": dados.get("dominio") or None},
        request=request)
    await sessao.commit()
    await sessao.refresh(usuario)
    return resultado


async def vinculo_institucional(sessao: AsyncSession,
                                usuario_id: uuid.UUID) -> str | None:
    """Domínio institucional da conta, quando algum provedor o comprovou."""
    alvo = config.dominio_institucional.strip().lower()
    if not alvo:
        return None
    dominios = (await sessao.scalars(
        select(IdentidadeExterna.dominio).where(
            IdentidadeExterna.usuario_id == usuario_id,
            IdentidadeExterna.dominio.is_not(None)))).all()
    return next((d for d in dominios if d.lower() == alvo), None)
