#!/usr/bin/env python3
"""
Uso simulado do Mais Horas, para o monitoramento ter o que mostrar.

Não grava nada no banco por fora: tudo passa pela API, pelas mesmas rotas e
regras que o site usa, então as métricas, a trilha de auditoria e os
certificados são de verdade. O que é simulado é quem está do outro lado.

- Cinco ONGs e trinta e seis estudantes, todos com e-mail em
  @demonstracao.mais-horas.org.
- Visitantes navegando pela vitrine, alunos entrando (às vezes errando a
  senha), se inscrevendo e acompanhando horas, ONGs aprovando inscrições.
- Atividades de verdade no relógio de verdade: a ONG cria uma vaga que começa
  daqui a pouco, alunos se inscrevem, fazem check-in pelo token do QR durante
  a janela e, no fim, a ONG valida presenças e o certificado sai assinado.
- Incidentes: força bruta numa conta, lista de e-mails sendo testada, varredura
  de códigos de certificado e reuso de token de sessão.

Cada pessoa tem um IP fixo das faixas reservadas para documentação (RFC 5737:
192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), enviado em X-Forwarded-For. O
simulador fala direto com api:3000, pela rede interna, então é o mesmo
cabeçalho que o Caddy enviaria. Essas faixas nunca pertencem a ninguém, e é
por elas e pelo domínio que `python -m app.cli remover-demonstracao` acha o
que apagar.
"""

from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx

API = os.environ.get("API_URL", "http://api:3000").rstrip("/") + "/api/v1"
SENHA = os.environ["SENHA_DEMONSTRACAO"]
INTENSIDADE = max(0.1, float(os.environ.get("INTENSIDADE", "1")))
DOMINIO = "demonstracao.mais-horas.org"
FUSO = ZoneInfo("America/Sao_Paulo")  # o mesmo relógio da API (RN-53)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s",
                    datefmt="%d/%m %H:%M:%S")
log = logging.getLogger("simulador")
# Uma linha por requisição afogaria o log; as métricas já contam cada uma.
logging.getLogger("httpx").setLevel(logging.WARNING)
aleatorio = random.Random()

NAVEGADORES = [
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; moto g54 5G) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/129.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
]
ROBOS = ["python-requests/2.32.3", "curl/8.5.0", "Go-http-client/1.1",
         "Mozilla/5.0 (compatible; Nmap Scripting Engine)"]

# ===================== Quem participa =====================

ONGS = {
    "verdemar": ("Instituto Verde Mar", {
        "descricao": "Cuidamos do litoral e dos mangues de Fortaleza com mutirões de "
                     "limpeza, plantio e educação ambiental nas escolas do entorno.",
        "instagram": "@institutoverdemar"}),
    "lagoa": ("Biblioteca Comunitária da Lagoa", {
        "descricao": "Biblioteca de bairro na Lagoa Redonda. Reforço escolar, contação "
                     "de histórias e um acervo de três mil livros doados pela vizinhança.",
        "instagram": "@bibliotecadalagoa"}),
    "cozinha": ("Cozinha Solidária Bom Jardim", {
        "descricao": "Preparamos 400 refeições por semana para famílias do Grande Bom "
                     "Jardim, com alimento doado por feirantes e produtores da região."}),
    "patas": ("Abrigo Patas Amigas", {
        "descricao": "Abrigo com 60 cães e gatos resgatados em Messejana. Precisamos de "
                     "gente para passeios, banho e as feiras de adoção do fim de semana.",
        "instagram": "@patasamigas.ce"}),
    "bemviver": ("Lar Bem Viver", {
        "descricao": "Casa de convivência para idosos no Montese. Música, oficinas e "
                     "companhia para quem passa o dia longe da família."}),
}

ATIVIDADES = {
    "verdemar": [
        ("Mutirão no mangue do Cocó", "Ponte do Rio Cocó, Av. Sebastião de Abreu",
         "Retirada de lixo preso nas raízes do mangue, de barco e a pé. Botas e luvas "
         "ficam por nossa conta."),
        ("Plantio no Parque do Cocó", "Parque do Cocó, Av. Padre Antônio Tomás",
         "Plantio de mudas nativas na margem do rio, com a equipe do parque."),
        ("Limpeza da Praia do Futuro", "Praia do Futuro, perto da Av. Zezé Diogo",
         "Recolhimento de resíduos na faixa de areia, com triagem para a cooperativa."),
        ("Trilha educativa nas dunas", "Parque das Dunas de Sabiaguaba",
         "Acompanhar turmas do fundamental na trilha, explicando a fauna e a flora."),
    ],
    "lagoa": [
        ("Contação de histórias", "Biblioteca Comunitária da Lagoa",
         "Leitura em voz alta para crianças de 4 a 8 anos, com desenho no fim."),
        ("Reforço de leitura, 5º ano", "Biblioteca Comunitária da Lagoa",
         "Acompanhamento individual de alunos com dificuldade de leitura."),
        ("Mutirão de catalogação", "Biblioteca Comunitária da Lagoa",
         "Cadastrar os livros doados no semestre e organizar as estantes."),
        ("Oficina de redação para o Enem", "Escola estadual da Lagoa Redonda",
         "Correção comentada de redações de estudantes do terceiro ano."),
    ],
    "cozinha": [
        ("Preparo de marmitas", "Cozinha Solidária, Rua Três Corações, 120",
         "Corte de legumes, preparo e montagem das marmitas. Touca e avental fornecidos."),
        ("Campanha de arrecadação", "Feira livre do Bom Jardim",
         "Ponto de coleta de alimentos na feira, com registro das doações."),
        ("Entrega de cestas básicas", "Cozinha Solidária, Rua Três Corações, 120",
         "Separação e entrega das cestas para as famílias cadastradas."),
    ],
    "patas": [
        ("Passeio com os cães do abrigo", "Abrigo Patas Amigas, Messejana",
         "Passeio de uma hora com os cães, em duplas, pelo entorno do abrigo."),
        ("Banho solidário", "Abrigo Patas Amigas, Messejana",
         "Banho e escovação dos cães que vão para a feira de adoção."),
        ("Feira de adoção", "Praça Luíza Távora",
         "Atendimento às famílias interessadas e cuidado com os animais na feira."),
    ],
    "bemviver": [
        ("Tarde de música no lar", "Lar Bem Viver, Montese",
         "Roda de música com os idosos. Quem toca violão ou canta é bem-vindo."),
        ("Oficina de celular para idosos", "Lar Bem Viver, Montese",
         "Ensinar a usar WhatsApp, chamada de vídeo e o app do banco com segurança."),
        ("Jogos e conversa", "Lar Bem Viver, Montese",
         "Dominó, cartas e conversa. A companhia é o que mais faz diferença."),
    ],
}

PRIMEIROS = ["Larissa", "Davi", "Bianca", "Thiago", "Ana Clara", "João Pedro", "Maria Eduarda",
             "Lucas", "Beatriz", "Gabriel", "Júlia", "Rafael", "Camila", "Mateus", "Letícia",
             "Pedro Henrique", "Isabela", "Gustavo", "Mariana", "Felipe", "Yasmin", "Bruno",
             "Raquel", "Vinícius", "Natália", "Caio", "Amanda", "Leonardo", "Sofia", "Igor",
             "Carolina", "Enzo", "Lívia", "Samuel", "Heloísa", "Arthur"]
SOBRENOMES = ["Monteiro", "Albuquerque", "Rocha", "Nunes", "Bezerra", "Holanda", "Pinheiro",
              "Cavalcante", "Freitas", "Lima", "Sampaio", "Teixeira", "Barros", "Magalhães",
              "Queiroz", "Fernandes", "Moreira", "Araújo", "Castro", "Mendes"]
CURSOS = ["Sistemas de Informação", "Direito", "Enfermagem", "Engenharia Civil", "Psicologia",
          "Administração", "Pedagogia", "Ciência da Computação", "Nutrição", "Fisioterapia",
          "Arquitetura e Urbanismo", "Medicina Veterinária", "Serviço Social", "Odontologia"]
INSTITUICOES = ["UniC"] * 7 + ["UFC", "UECE", "IFCE"]


def _sem_acento(texto: str) -> str:
    trocas = str.maketrans("áàâãéêíóôõúçÁÉÍÓÚÇ", "aaaaeeiooouc" + "AEIOUC")
    return texto.translate(trocas).lower().replace(" ", ".")


@dataclass
class Pessoa:
    chave: str
    nome: str
    email: str
    papel: str
    ip: str
    navegador: str
    perfil: dict
    token: str | None = None
    refresh: str | None = None
    id: str | None = None


def _montar_pessoas() -> tuple[dict[str, Pessoa], dict[str, Pessoa]]:
    gerador = random.Random(2026)  # sempre as mesmas pessoas, a cada reinício
    ongs = {}
    for i, (chave, (nome, extra)) in enumerate(ONGS.items()):
        ongs[chave] = Pessoa(chave, nome, f"contato.{chave}@{DOMINIO}", "ong",
                             f"192.0.2.{20 + i}", gerador.choice(NAVEGADORES[3:]),
                             {"nome_organizacao": nome, "cidade": "Fortaleza", "estado": "CE",
                              **extra})
    alunos = {}
    for i, primeiro in enumerate(PRIMEIROS):
        sobrenome = SOBRENOMES[i % len(SOBRENOMES)]
        segundo = SOBRENOMES[(i * 7 + 3) % len(SOBRENOMES)]
        email = f"{_sem_acento(primeiro)}.{_sem_acento(sobrenome)}@{DOMINIO}"
        alunos[email] = Pessoa(
            email, f"{primeiro} {sobrenome}", email, "estudante", f"198.51.100.{20 + i}",
            gerador.choice(NAVEGADORES),
            {"nome_completo": f"{primeiro} {segundo} {sobrenome}",
             "instituicao": gerador.choice(INSTITUICOES), "curso": gerador.choice(CURSOS),
             "cidade": "Fortaleza", "estado": "CE"})
    return ongs, alunos


# ===================== Conversa com a API =====================


class Api:
    def __init__(self, http: httpx.AsyncClient):
        self.http = http

    async def pedir(self, metodo: str, rota: str, *, quem: Pessoa | None = None,
                    ip: str | None = None, navegador: str | None = None,
                    json: dict | None = None, params: dict | None = None,
                    refresh: str | None = None, autenticar: bool = True) -> httpx.Response:
        cabecalhos = {
            "X-Forwarded-For": ip or (quem.ip if quem else "198.51.100.250"),
            "User-Agent": navegador or (quem.navegador if quem else NAVEGADORES[0]),
        }
        if quem and quem.token and autenticar:
            cabecalhos["Authorization"] = f"Bearer {quem.token}"
        if refresh:
            # O cookie é Secure; pela rede interna (http) o httpx não o mandaria
            # sozinho, então ele vai no cabeçalho, como o navegador faria.
            cabecalhos["Cookie"] = f"mh_refresh={refresh}"
        resposta = await self.http.request(metodo, API + rota, headers=cabecalhos,
                                           json=json, params=params)
        if resposta.status_code >= 500:
            log.warning("%s %s respondeu %s", metodo, rota, resposta.status_code)
        return resposta

    @staticmethod
    def _refresh_da(resposta: httpx.Response) -> str | None:
        for cabecalho in resposta.headers.get_list("set-cookie"):
            if cabecalho.startswith("mh_refresh="):
                return cabecalho.split(";", 1)[0].split("=", 1)[1] or None
        return None

    async def entrar(self, pessoa: Pessoa, senha: str = SENHA) -> bool:
        resposta = await self.pedir("POST", "/auth/entrar", quem=pessoa, autenticar=False,
                                    json={"email": pessoa.email, "senha": senha})
        if resposta.status_code != 200:
            return False
        corpo = resposta.json()
        pessoa.token, pessoa.id = corpo["token"], corpo["usuario"]["id"]
        pessoa.refresh = self._refresh_da(resposta)
        return True

    async def renovar(self, pessoa: Pessoa) -> httpx.Response:
        resposta = await self.pedir("POST", "/auth/renovar", quem=pessoa, autenticar=False,
                                    refresh=pessoa.refresh)
        if resposta.status_code == 200:
            pessoa.token = resposta.json()["token"]
            pessoa.refresh = self._refresh_da(resposta) or pessoa.refresh
        return resposta

    async def sair(self, pessoa: Pessoa) -> None:
        await self.pedir("POST", "/auth/sair", quem=pessoa, refresh=pessoa.refresh)
        pessoa.token = pessoa.refresh = None

    async def garantir_conta(self, pessoa: Pessoa) -> bool:
        """Cria a conta na primeira vez; depois, só entra."""
        resposta = await self.pedir("POST", "/auth/cadastro", quem=pessoa, autenticar=False,
                                    json={"nome": pessoa.nome, "email": pessoa.email,
                                          "senha": SENHA, "papel": pessoa.papel})
        if resposta.status_code == 201:
            corpo = resposta.json()
            pessoa.token, pessoa.id = corpo["token"], corpo["usuario"]["id"]
            pessoa.refresh = self._refresh_da(resposta)
            await self.pedir("PUT", "/perfil", quem=pessoa, json=pessoa.perfil)
            log.info("conta criada: %s", pessoa.email)
            return True
        if resposta.status_code == 409 and await self.entrar(pessoa):
            return True
        log.warning("não consegui entrar com %s (%s)", pessoa.email, resposta.status_code)
        return False


# ===================== O simulador =====================


def agora() -> datetime:
    return datetime.now(FUSO)


def movimento(hora: int) -> float:
    """Quanto do pico de acesso há em cada hora do dia (aluno estuda à noite também)."""
    curva = [0.05, 0.03, 0.02, 0.02, 0.03, 0.08, 0.2, 0.45, 0.75, 0.9, 1.0, 0.95,
             0.7, 0.75, 0.9, 1.0, 0.95, 0.8, 0.65, 0.75, 0.85, 0.7, 0.4, 0.15]
    return curva[hora]


@dataclass
class Simulador:
    api: Api
    ongs: dict[str, Pessoa]
    alunos: dict[str, Pessoa]
    codigos: list[str] = field(default_factory=list)
    atividades_do_dia: dict[date, int] = field(default_factory=dict)
    ultima_do_dia: datetime | None = None
    # Quem está no meio de um cenário. Uma pessoa faz uma coisa por vez: dois
    # cenários com a mesma sessão trocariam o refresh token um do outro, e a
    # API (com razão) leria isso como token roubado.
    ocupadas: set[str] = field(default_factory=set)

    @asynccontextmanager
    async def usar(self, pessoa: Pessoa):
        self.ocupadas.add(pessoa.chave)
        try:
            yield pessoa
        finally:
            self.ocupadas.discard(pessoa.chave)

    def livre(self, grupo: dict[str, Pessoa]) -> Pessoa | None:
        livres = [p for p in grupo.values() if p.chave not in self.ocupadas]
        return aleatorio.choice(livres) if livres else None

    # ---------- preparação ----------

    async def preparar(self) -> None:
        for pessoa in [*self.ongs.values(), *self.alunos.values()]:
            await self.api.garantir_conta(pessoa)
            await asyncio.sleep(0.3)
        await self.manter_vitrine()
        log.info("base pronta: %d ONGs, %d estudantes", len(self.ongs), len(self.alunos))

    async def sessao(self, pessoa: Pessoa) -> bool:
        """Garante token válido: renova se der, entra de novo se não."""
        if pessoa.token:
            teste = await self.api.pedir("GET", "/perfil", quem=pessoa)
            if teste.status_code == 200:
                return True
            if pessoa.refresh and (await self.api.renovar(pessoa)).status_code == 200:
                return True
        return await self.api.entrar(pessoa)

    async def criar_atividade(self, ong: Pessoa, dia: date, inicio: str, fim: str, *,
                              vagas: int, aprovacao: bool = False) -> dict | None:
        titulo, local, descricao = aleatorio.choice(ATIVIDADES[ong.chave])
        criada = await self.api.pedir("POST", "/atividades", quem=ong, json={
            "titulo": titulo, "descricao": descricao, "local": local, "cidade": "Fortaleza",
            "estado": "CE", "data": dia.isoformat(), "hora_inicio": inicio, "hora_fim": fim,
            "vagas_min": 1, "vagas_max": vagas, "exige_aprovacao": aprovacao})
        if criada.status_code != 201:
            log.warning("ONG %s não criou atividade: %s", ong.chave, criada.text[:160])
            return None
        atividade = criada.json()
        publicada = await self.api.pedir("POST", f"/atividades/{atividade['id']}/publicar",
                                         quem=ong)
        return publicada.json() if publicada.status_code == 200 else None

    async def manter_vitrine(self) -> None:
        """Cada ONG com duas ou três vagas abertas nas próximas semanas."""
        for ong in self.ongs.values():
            if ong.chave in self.ocupadas:
                continue
            async with self.usar(ong):
                await self._repor_vitrine(ong)

    async def _repor_vitrine(self, ong: Pessoa) -> None:
        if not await self.sessao(ong):
            return
        abertas = await self.api.pedir("GET", "/atividades/minhas", quem=ong,
                                       params={"situacao": "publicada", "tamanho": 20})
        if abertas.status_code != 200:
            return
        futuras = [a for a in abertas.json()["itens"]
                   if a["data"] > (agora().date() + timedelta(days=1)).isoformat()]
        for _ in range(max(0, aleatorio.randint(2, 3) - len(futuras))):
            dia = agora().date() + timedelta(days=aleatorio.randint(3, 24))
            hora = aleatorio.choice([7, 8, 9, 14, 15])
            duracao = aleatorio.choice([2, 3, 4])
            await self.criar_atividade(
                ong, dia, f"{hora:02d}:00", f"{hora + duracao:02d}:00",
                vagas=aleatorio.choice([6, 8, 10, 12, 15, 20]),
                aprovacao=aleatorio.random() < 0.3)

    # ---------- a atividade do dia, no relógio de verdade ----------

    async def atividade_do_dia(self) -> None:
        ong = self.livre(self.ongs)
        if ong is None:
            return
        async with self.usar(ong):
            await self._conduzir_atividade(ong)

    async def _conduzir_atividade(self, ong: Pessoa) -> None:
        if not await self.sessao(ong):
            return
        inicio = agora() + timedelta(minutes=18)
        inicio = inicio.replace(minute=inicio.minute - inicio.minute % 5, second=0,
                                microsecond=0)
        fim = inicio + timedelta(minutes=aleatorio.choice([60, 90]))
        if fim.date() != inicio.date():
            return
        atividade = await self.criar_atividade(
            ong, inicio.date(), inicio.strftime("%H:%M"), fim.strftime("%H:%M"),
            vagas=aleatorio.choice([10, 12, 15]))
        if atividade is None:
            return
        log.info("atividade do dia: %s (%s), %s às %s", atividade["titulo"], ong.nome,
                 inicio.strftime("%H:%M"), fim.strftime("%H:%M"))

        # Inscrições até o começo.
        candidatos = aleatorio.sample(list(self.alunos.values()), k=aleatorio.randint(7, 11))
        inscritos = []
        for aluno in candidatos:
            await asyncio.sleep(aleatorio.uniform(20, 70))
            if aluno.chave in self.ocupadas:
                continue
            async with self.usar(aluno):
                if not await self.sessao(aluno):
                    continue
                await self.api.pedir("GET", f"/atividades/{atividade['id']}", quem=aluno)
                resposta = await self.api.pedir("POST", "/inscricoes", quem=aluno,
                                                json={"atividadeId": atividade["id"]})
                if resposta.status_code == 201:
                    inscritos.append(aluno)

        # Durante a janela, a ONG deixa o painel de check-in aberto e o token gira.
        espera = (inicio - agora()).total_seconds() + 30
        await asyncio.sleep(max(0, espera))
        token_velho = None
        pendentes = [a for a in inscritos if aleatorio.random() < 0.85]
        for minuto in range(30):
            gerado = await self.api.pedir("GET", f"/atividades/{atividade['id']}/checkin/token",
                                          quem=ong)
            await self.api.pedir("GET", f"/atividades/{atividade['id']}/checkin/painel",
                                 quem=ong)
            if gerado.status_code != 200:
                await self.sessao(ong)
                await asyncio.sleep(30)
                continue
            token = gerado.json()["token"]
            if minuto == 2:
                token_velho = token
            chegando = [a for a in pendentes
                        if a.chave not in self.ocupadas and aleatorio.random() < 0.35]
            for aluno in chegando:
                async with self.usar(aluno):
                    if not await self.sessao(aluno):
                        continue
                    if token_velho and minuto >= 5 and aleatorio.random() < 0.25:
                        # O print do QR que chegou pelo WhatsApp: vencido.
                        await self.api.pedir("POST", "/checkin", quem=aluno,
                                             json={"token": token_velho})
                        await asyncio.sleep(aleatorio.uniform(2, 6))
                    resposta = await self.api.pedir("POST", "/checkin", quem=aluno,
                                                    json={"token": token})
                    if resposta.status_code in (200, 201, 409):
                        pendentes.remove(aluno)
            if not pendentes:
                break
            await asyncio.sleep(30)

        # Depois do fim, a ONG decide a presença e finaliza: o certificado sai.
        await asyncio.sleep(max(0, (fim - agora()).total_seconds() + 120))
        await self.validar_e_finalizar(ong, atividade["id"])

    async def validar_e_finalizar(self, ong: Pessoa, atividade_id: str) -> None:
        if not await self.sessao(ong):
            return
        lista = await self.api.pedir("GET", f"/atividades/{atividade_id}/presencas", quem=ong)
        if lista.status_code != 200:
            return
        decisoes = []
        for item in lista.json()["itens"]:
            if item["situacao"] == "pendente":
                await self.api.pedir("POST", f"/inscricoes/{item['inscricaoId']}/recusar",
                                     quem=ong)
                continue
            presente = item.get("checkinEm") or aleatorio.random() < 0.8
            decisoes.append({"inscricaoId": item["inscricaoId"],
                             "situacao": "presente" if presente else "ausente"})
        if decisoes:
            await self.api.pedir("PUT", f"/atividades/{atividade_id}/presencas", quem=ong,
                                 json={"decisoes": decisoes})
        final = await self.api.pedir("POST", f"/atividades/{atividade_id}/finalizar", quem=ong)
        if final.status_code == 200:
            log.info("finalizada por %s: %s certificados", ong.nome,
                     final.json().get("certificadosEmitidos"))

    async def ciclo_do_dia(self) -> None:
        while True:
            momento = agora()
            hoje = momento.date()
            feitas = self.atividades_do_dia.get(hoje, 0)
            distante = (self.ultima_do_dia is None
                        or momento - self.ultima_do_dia > timedelta(hours=3))
            if 8 <= momento.hour < 18 and feitas < 3 and distante:
                self.atividades_do_dia[hoje] = feitas + 1
                self.ultima_do_dia = momento
                asyncio.create_task(self._proteger(self.atividade_do_dia()))
            await asyncio.sleep(600)

    async def manutencao(self) -> None:
        """A cada meia hora: ONGs validam o que já aconteceu e repõem a vitrine."""
        while True:
            await asyncio.sleep(1800)
            for ong in self.ongs.values():
                if ong.chave in self.ocupadas:
                    continue
                async with self.usar(ong):
                    if not await self.sessao(ong):
                        continue
                    passadas = await self.api.pedir(
                        "GET", "/atividades/minhas", quem=ong,
                        params={"situacao": "aguardando_validacao", "tamanho": 20})
                    if passadas.status_code == 200:
                        for atividade in passadas.json()["itens"]:
                            await self.validar_e_finalizar(ong, atividade["id"])
                    await self.aprovar_pendentes(ong)
            await self.manter_vitrine()

    async def aprovar_pendentes(self, ong: Pessoa) -> None:
        abertas = await self.api.pedir("GET", "/atividades/minhas", quem=ong,
                                       params={"situacao": "publicada", "tamanho": 20})
        if abertas.status_code != 200:
            return
        for atividade in abertas.json()["itens"]:
            if not atividade.get("exigeAprovacao"):
                continue
            pedidos = await self.api.pedir("GET", f"/atividades/{atividade['id']}/inscricoes",
                                           quem=ong, params={"situacao": "pendente"})
            if pedidos.status_code != 200:
                continue
            ids = [i["id"] for i in pedidos.json()["itens"] if i["situacao"] == "pendente"]
            if not ids:
                continue
            if len(ids) > 2 and aleatorio.random() < 0.3:
                await self.api.pedir("POST", f"/inscricoes/{ids.pop()}/recusar", quem=ong)
            await self.api.pedir("POST", "/inscricoes/aprovar-lote", quem=ong,
                                 json={"ids": ids})

    # ---------- tráfego do dia a dia ----------

    async def visitante(self) -> None:
        ip = f"198.51.100.{aleatorio.randint(100, 240)}"
        navegador = aleatorio.choice(NAVEGADORES)
        pedir = lambda rota, **kw: self.api.pedir("GET", rota, ip=ip, navegador=navegador, **kw)  # noqa: E731
        await pedir("/portal/resumo")
        vitrine = await pedir("/atividades", params=aleatorio.choice([
            {}, {"comVaga": "true"}, {"busca": aleatorio.choice(["praia", "leitura", "idosos",
                                                                 "animais", "marmitas"])},
            {"cargaMin": 3}]))
        if vitrine.status_code == 200 and vitrine.json()["itens"]:
            for atividade in aleatorio.sample(vitrine.json()["itens"],
                                              k=min(2, len(vitrine.json()["itens"]))):
                await asyncio.sleep(aleatorio.uniform(3, 15))
                await pedir(f"/atividades/{atividade['id']}")
        if aleatorio.random() < 0.4:
            ongs = await pedir("/portal/ongs")
            if ongs.status_code == 200 and ongs.json()["itens"]:
                await pedir(f"/portal/ongs/{aleatorio.choice(ongs.json()['itens'])['id']}")

    async def coordenacao(self) -> None:
        """Alguém da faculdade conferindo certificados pelo código."""
        if not self.codigos:
            return
        ip = f"192.0.2.{aleatorio.randint(100, 140)}"
        for codigo in aleatorio.sample(self.codigos, k=min(3, len(self.codigos))):
            await self.api.pedir("GET", f"/certificados/verificar/{codigo}", ip=ip,
                                 navegador=NAVEGADORES[3])
            if aleatorio.random() < 0.3:
                await self.api.pedir("GET", f"/certificados/verificar/{codigo}/pdf", ip=ip,
                                     navegador=NAVEGADORES[3])
            await asyncio.sleep(aleatorio.uniform(5, 20))
        if aleatorio.random() < 0.3:
            # Código digitado errado.
            await self.api.pedir("GET", f"/certificados/verificar/{uuid.uuid4().hex[:16]}",
                                 ip=ip, navegador=NAVEGADORES[3])

    async def aluno(self) -> None:
        aluno = self.livre(self.alunos)
        if aluno is not None:
            async with self.usar(aluno):
                await self._sessao_de_aluno(aluno)

    async def _sessao_de_aluno(self, aluno: Pessoa) -> None:
        if aleatorio.random() < 0.12:
            # Errou a senha antes de acertar.
            await self.api.entrar(aluno, senha=SENHA[:-2] + aleatorio.choice(["12", "!", "aa"]))
            await asyncio.sleep(aleatorio.uniform(4, 12))
        if not await self.api.entrar(aluno):
            return
        for rota in ("/perfil", "/painel/estudante", "/notificacoes/contador"):
            await self.api.pedir("GET", rota, quem=aluno)
        await asyncio.sleep(aleatorio.uniform(5, 30))
        escolha = aleatorio.random()
        if escolha < 0.35:
            await self.api.pedir("GET", "/inscricoes/minhas", quem=aluno,
                                 params={"grupo": aleatorio.choice(["proximas", "historico"])})
        elif escolha < 0.6:
            meus = await self.api.pedir("GET", "/certificados/meus", quem=aluno)
            if meus.status_code == 200 and meus.json()["itens"]:
                certificado = aleatorio.choice(meus.json()["itens"])
                if certificado["codigo"] not in self.codigos:
                    self.codigos.append(certificado["codigo"])
                if aleatorio.random() < 0.5:
                    await self.api.pedir("GET", f"/certificados/{certificado['id']}/pdf",
                                         quem=aluno)
        elif escolha < 0.85:
            vitrine = await self.api.pedir("GET", "/atividades", quem=aluno,
                                           params={"comVaga": "true"})
            livres = [a for a in vitrine.json().get("itens", [])
                      if not a.get("minhaInscricao")] if vitrine.status_code == 200 else []
            if livres:
                escolhida = aleatorio.choice(livres)
                await self.api.pedir("GET", f"/atividades/{escolhida['id']}", quem=aluno)
                await self.api.pedir("POST", "/inscricoes", quem=aluno,
                                     json={"atividadeId": escolhida["id"]})
        else:
            await self.api.pedir("GET", "/notificacoes", quem=aluno)
            await self.api.pedir("POST", "/notificacoes/lidas", quem=aluno)
        if aleatorio.random() < 0.3:
            await asyncio.sleep(aleatorio.uniform(20, 60))
            await self.api.renovar(aluno)
        if aleatorio.random() < 0.5:
            await self.api.sair(aluno)

    async def ong(self) -> None:
        ong = self.livre(self.ongs)
        if ong is None:
            return
        async with self.usar(ong):
            if not await self.api.entrar(ong):
                return
            await self.api.pedir("GET", "/painel/ong", quem=ong)
            await self.api.pedir("GET", "/atividades/minhas", quem=ong,
                                 params={"situacao": aleatorio.choice(
                                     ["publicada", "rascunho", "finalizada"])})
            await self.aprovar_pendentes(ong)

    async def robo(self) -> None:
        """Ruído de internet: robôs atrás de painel de WordPress e arquivo de senha."""
        ip = f"203.0.113.{aleatorio.randint(150, 250)}"
        for caminho in aleatorio.sample(["/wp-login.php", "/.env", "/admin.php", "/xmlrpc.php",
                                         "/api/v1/../../etc/passwd", "/phpmyadmin/",
                                         f"/api/v1/atividades/{uuid.uuid4()}"], k=3):
            await self.api.http.get(API.replace("/api/v1", "") + caminho, headers={
                "X-Forwarded-For": ip, "User-Agent": aleatorio.choice(ROBOS)})

    async def trafego(self) -> None:
        cenarios = [(self.visitante, 45), (self.aluno, 30), (self.ong, 10),
                    (self.coordenacao, 8), (self.robo, 7)]
        funcoes, pesos = zip(*cenarios)
        while True:
            fator = movimento(agora().hour) * INTENSIDADE
            await asyncio.sleep(aleatorio.expovariate(fator / 12))
            asyncio.create_task(self._proteger(aleatorio.choices(funcoes, pesos)[0]()))

    # ---------- incidentes ----------

    async def forca_bruta(self) -> None:
        alvo = aleatorio.choice(list(self.alunos.values()))
        ip = f"203.0.113.{aleatorio.randint(10, 60)}"
        log.info("incidente: força bruta em %s a partir de %s", alvo.email, ip)
        for tentativa in range(aleatorio.randint(35, 60)):
            await self.api.pedir("POST", "/auth/entrar", ip=ip, navegador=ROBOS[0],
                                 json={"email": alvo.email, "senha": f"senha{tentativa:03d}"})
            await asyncio.sleep(aleatorio.uniform(0.8, 2.5))

    async def lista_de_emails(self) -> None:
        ip = f"203.0.113.{aleatorio.randint(61, 100)}"
        log.info("incidente: lista de e-mails testada a partir de %s", ip)
        emails = [p.email for p in aleatorio.sample(list(self.alunos.values()), k=12)]
        emails += [f"{nome}@{DOMINIO}" for nome in
                   ("admin", "contato", "suporte", "teste", "financeiro", "rh", "diretoria")]
        for email in aleatorio.sample(emails, k=len(emails)):
            await self.api.pedir("POST", "/auth/entrar", ip=ip, navegador=ROBOS[2],
                                 json={"email": email, "senha": aleatorio.choice(
                                     ["123456", "senha123", "mudar@123", "fortaleza2026"])})
            await asyncio.sleep(aleatorio.uniform(8, 25))

    async def varredura(self) -> None:
        ip = f"203.0.113.{aleatorio.randint(101, 140)}"
        log.info("incidente: varredura de certificados a partir de %s", ip)
        for _ in range(aleatorio.randint(80, 120)):
            await self.api.pedir("GET", f"/certificados/verificar/{uuid.uuid4().hex[:16]}",
                                 ip=ip, navegador=ROBOS[1])
            await asyncio.sleep(0.3)

    async def sessao_roubada(self) -> None:
        """O refresh token copiado volta depois de já ter sido trocado."""
        vitima = self.livre(self.alunos)
        if vitima is None:
            return
        async with self.usar(vitima):
            if not await self.api.entrar(vitima):
                return
            copiado = vitima.refresh
            await asyncio.sleep(5)
            await self.api.renovar(vitima)          # o dono segue usando
            await asyncio.sleep(25)                 # depois da janela de 15 s
            ip = f"203.0.113.{aleatorio.randint(141, 149)}"
            log.info("incidente: token de sessão de %s reapresentado de %s",
                     vitima.email, ip)
            await self.api.pedir("POST", "/auth/renovar", ip=ip, navegador=NAVEGADORES[4],
                                 refresh=copiado)
            vitima.token = vitima.refresh = None

    async def incidentes(self) -> None:
        roteiro = [self.forca_bruta, self.varredura, self.sessao_roubada, self.lista_de_emails]
        # Logo depois de subir, um de cada, para os painéis mostrarem o que acontece.
        for incidente in roteiro:
            await asyncio.sleep(aleatorio.uniform(240, 480))
            await self._proteger(incidente())
        while True:
            await asyncio.sleep(aleatorio.uniform(6, 14) * 3600)
            await self._proteger(aleatorio.choice(roteiro)())

    # ---------- infraestrutura ----------

    @staticmethod
    async def _proteger(tarefa) -> None:
        try:
            await tarefa
        except Exception as erro:  # o simulador não para por causa de um cenário
            log.warning("cenário falhou: %s: %s", erro.__class__.__name__, erro)


async def main() -> None:
    ongs, alunos = _montar_pessoas()
    limites = httpx.Limits(max_connections=20, max_keepalive_connections=10)
    async with httpx.AsyncClient(timeout=30, limits=limites) as http:
        api = Api(http)
        while True:
            try:
                if (await http.get(API.replace("/api/v1", "") + "/saude")).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            log.info("esperando a API responder")
            await asyncio.sleep(10)
        simulador = Simulador(api, ongs, alunos)
        await simulador.preparar()
        await asyncio.gather(simulador.trafego(), simulador.ciclo_do_dia(),
                             simulador.manutencao(), simulador.incidentes())


if __name__ == "__main__":
    asyncio.run(main())
