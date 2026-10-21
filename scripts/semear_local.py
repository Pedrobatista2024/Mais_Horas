#!/usr/bin/env python3
"""
Popula a base **local** com dados realistas, para desenvolver e revisar telas.

Uma base vazia, ou só com sobras de teste, esconde metade dos estados da
interface: não há vaga aberta, nada acontece hoje, ninguém espera aprovação. Este
roteiro cria três ONGs, quatro estudantes e doze atividades que cobrem todas as
situações — aberta, com aprovação, lotada, acontecendo agora, aguardando
validação, finalizada com certificado, cancelada e rascunho.

Passa pelas mesmas rotas que o site usa, então as regras valem de verdade. Só
o relógio é ajustado direto no banco, como em `demonstrar_validacao.py`: a API
não deixa criar atividade no passado, e é preciso passado para haver certificado.

Uso (Postgres e API locais no ar, base sem esta semeadura):

    cd backend
    .venv/Scripts/python ../scripts/semear_local.py

Todas as contas usam a senha de `demonstrar_validacao.SENHA`. A principal, para
ver a área do aluno cheia, é larissa.monteiro@mais-horas-demo.org; a da ONG,
contato@verdemar.mais-horas-demo.org; a do admin, admin-demo@mais-horas-demo.org.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from datetime import datetime, time as hora_do_dia, timedelta
from pathlib import Path

import httpx

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend"))
sys.path.insert(0, str(RAIZ / "scripts"))

from demonstrar_validacao import SENHA  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DOMINIO = "mais-horas-demo.org"

ONGS = {
    "verdemar": {
        "nome": "Instituto Verde Mar",
        "email": f"contato@verdemar.{DOMINIO}",
        "perfil": {
            "nome_organizacao": "Instituto Verde Mar",
            "descricao": "Cuidamos do litoral e dos mangues de Fortaleza com mutirões "
                         "de limpeza, plantio e educação ambiental nas escolas do "
                         "entorno.",
            "cidade": "Fortaleza", "estado": "CE",
            "site": "https://verdemar.org.br", "instagram": "@institutoverdemar",
        },
        "verificar": True,
    },
    "lagoa": {
        "nome": "Biblioteca Comunitária da Lagoa",
        "email": f"contato@bibliotecalagoa.{DOMINIO}",
        "perfil": {
            "nome_organizacao": "Biblioteca Comunitária da Lagoa",
            "descricao": "Biblioteca de bairro na Lagoa Redonda. Reforço escolar, "
                         "contação de histórias e um acervo de três mil livros "
                         "doados pela vizinhança.",
            "cidade": "Fortaleza", "estado": "CE",
            "instagram": "@bibliotecadalagoa",
        },
        "verificar": False,
    },
    "cozinha": {
        "nome": "Cozinha Solidária Bom Jardim",
        "email": f"contato@cozinhabomjardim.{DOMINIO}",
        "perfil": {
            "nome_organizacao": "Cozinha Solidária Bom Jardim",
            "descricao": "Preparamos 400 refeições por semana para famílias do "
                         "Grande Bom Jardim, com alimento doado por feirantes e "
                         "produtores da região.",
            "cidade": "Fortaleza", "estado": "CE",
        },
        "verificar": False,
    },
}

ESTUDANTES = {
    "larissa": ("Larissa Monteiro", "Larissa Monteiro de Sousa",
                "Sistemas de Informação"),
    "davi": ("Davi Albuquerque", "Davi Albuquerque Lima", "Direito"),
    "bianca": ("Bianca Rocha", "Bianca Rocha Freitas", "Enfermagem"),
    "thiago": ("Thiago Nunes", "Thiago Nunes Bezerra", "Engenharia Civil"),
}


def email_de(chave: str) -> str:
    nome = ESTUDANTES[chave][0].lower().replace(" ", ".")
    return f"{nome}@{DOMINIO}"


def linha(rotulo: str, valor: object = "") -> None:
    print(f"   {rotulo:<38} {valor}")


class Semeadura:
    def __init__(self, http: httpx.AsyncClient):
        self.http = http
        self.tokens: dict[str, str] = {}
        self.ids: dict[str, str] = {}

    def cab(self, quem: str) -> dict:
        return {"Authorization": f"Bearer {self.tokens[quem]}"}

    async def pedir(self, metodo: str, rota: str, quem: str | None = None, **kw):
        resposta = await self.http.request(
            metodo, rota, headers=self.cab(quem) if quem else None, **kw)
        if resposta.status_code >= 400:
            sys.exit(f"{metodo} {rota} → {resposta.status_code}: {resposta.text}")
        return resposta.json() if resposta.content else None

    async def cadastrar(self, chave: str, nome: str, email: str, papel: str) -> None:
        dados = await self.pedir("POST", "/auth/cadastro", json={
            "nome": nome, "email": email, "senha": SENHA, "papel": papel})
        self.tokens[chave] = dados["token"]
        self.ids[chave] = (await self.pedir("GET", "/perfil", chave))["id"]

    async def atividade(self, ong: str, titulo: str, descricao: str, local: str,
                        dias: int, inicio: str, fim: str, *, vagas: int = 20,
                        aprovacao: bool = False, publicar: bool = True) -> str:
        criada = await self.pedir("POST", "/atividades", ong, json={
            "titulo": titulo, "descricao": descricao, "local": local,
            "cidade": "Fortaleza", "estado": "CE",
            "data": (hoje() + timedelta(days=dias)).isoformat(),
            "hora_inicio": inicio, "hora_fim": fim,
            "vagas_min": 1, "vagas_max": vagas, "exige_aprovacao": aprovacao})
        if publicar:
            await self.pedir("POST", f"/atividades/{criada['id']}/publicar", ong)
        return criada["id"]

    async def inscrever(self, aluno: str, atividade: str) -> str:
        dados = await self.pedir("POST", "/inscricoes", aluno,
                                 json={"atividadeId": atividade})
        return dados["id"]

    async def checkin(self, ong: str, aluno: str, atividade: str) -> None:
        token = await self.pedir("GET", f"/atividades/{atividade}/checkin/token", ong)
        await self.pedir("POST", "/checkin", aluno, json={"token": token["token"]})


def hoje():
    from app.services.atividade_service import hoje as hoje_do_sistema
    return hoje_do_sistema()


async def mover(atividade: str, dias: int, inicio: hora_do_dia | None = None,
                fim: hora_do_dia | None = None) -> None:
    """Ajusta data e horário direto no banco: é o único jeito de ter passado."""
    from app.db.models import Atividade
    from app.db.session import CriarSessao

    async with CriarSessao() as db:
        gravada = await db.get(Atividade, uuid.UUID(atividade))
        gravada.data = hoje() + timedelta(days=dias)
        if inicio is not None:
            gravada.hora_inicio, gravada.hora_fim = inicio, fim
        await db.commit()


def janela_de_agora() -> tuple[hora_do_dia, hora_do_dia]:
    """Começou há uma hora e termina daqui a três, sem atravessar a meia-noite."""
    agora = datetime.now()
    inicio = max(agora - timedelta(hours=1), agora.replace(hour=0, minute=0))
    fim = min(agora + timedelta(hours=3), agora.replace(hour=23, minute=59))
    return (inicio.time().replace(minute=0 if inicio.minute < 30 else 30, second=0,
                                  microsecond=0),
            fim.time().replace(minute=0 if fim.minute < 30 else 30, second=0,
                               microsecond=0))


async def ja_semeada() -> bool:
    from sqlalchemy import select

    from app.db.models import Usuario
    from app.db.session import CriarSessao

    async with CriarSessao() as db:
        return bool(await db.scalar(
            select(Usuario.id).where(Usuario.email == email_de("larissa"))))


async def main(api: str) -> int:
    from app.core.config import config

    if not any(h in config.database_url for h in ("localhost", "127.0.0.1")):
        sys.exit("A base configurada não é local. Este roteiro só roda em base local.")
    if await ja_semeada():
        sys.exit("A base já foi semeada. Recrie o banco para semear de novo.")

    async with httpx.AsyncClient(base_url=f"{api}/api/v1", timeout=30) as http:
        s = Semeadura(http)

        print("\nContas")
        for chave, ong in ONGS.items():
            await s.cadastrar(chave, ong["nome"], ong["email"], "ong")
            await s.pedir("PUT", "/perfil", chave, json=ong["perfil"])
            linha(ong["nome"], ong["email"])
        for chave, (nome, completo, curso) in ESTUDANTES.items():
            await s.cadastrar(chave, nome, email_de(chave), "estudante")
            await s.pedir("PUT", "/perfil", chave, json={
                "nome_completo": completo, "instituicao": "UniC", "curso": curso,
                "cidade": "Fortaleza", "estado": "CE"})
            linha(nome, email_de(chave))

        print("\nAtividades que já aconteceram")
        # Criadas no futuro, levadas para hoje para o check-in e depois para o
        # passado, onde a ONG decide presença e finaliza.
        agora_ini, agora_fim = janela_de_agora()

        plantio = await s.atividade(
            "verdemar", "Plantio no Parque do Cocó",
            "Plantio de 300 mudas nativas na margem do rio, com a equipe do parque. "
            "Use roupa que pode sujar e traga garrafa d'água.",
            "Parque do Cocó, Av. Padre Antônio Tomás", 1, "07:30", "11:30")
        catalogacao = await s.atividade(
            "lagoa", "Mutirão de catalogação",
            "Cadastrar no sistema os livros doados no último semestre e organizar "
            "as estantes por faixa etária.",
            "Biblioteca Comunitária da Lagoa", 1, "14:00", "18:00")
        praia = await s.atividade(
            "verdemar", "Limpeza da Praia do Futuro",
            "Recolhimento de resíduos na faixa de areia entre as barracas, com "
            "triagem do material para a cooperativa de reciclagem.",
            "Praia do Futuro, em frente ao Crocobeach", 1, "06:30", "10:30")

        ins = {}
        ins["plantio_larissa"] = await s.inscrever("larissa", plantio)
        ins["plantio_thiago"] = await s.inscrever("thiago", plantio)
        ins["catalogacao_larissa"] = await s.inscrever("larissa", catalogacao)
        ins["praia_bianca"] = await s.inscrever("bianca", praia)
        ins["praia_thiago"] = await s.inscrever("thiago", praia)
        ins["praia_davi"] = await s.inscrever("davi", praia)

        for atividade in (plantio, catalogacao, praia):
            await mover(atividade, 0, agora_ini, agora_fim)
        await s.checkin("verdemar", "larissa", plantio)
        await s.checkin("lagoa", "larissa", catalogacao)
        await s.checkin("verdemar", "bianca", praia)
        await s.checkin("verdemar", "thiago", praia)

        await mover(plantio, -14, hora_do_dia(7, 30), hora_do_dia(11, 30))
        await mover(catalogacao, -20, hora_do_dia(14), hora_do_dia(18))
        await mover(praia, -1, hora_do_dia(6, 30), hora_do_dia(10, 30))

        await s.pedir("PUT", f"/inscricoes/{ins['plantio_larissa']}/presenca",
                      "verdemar", json={"situacao": "presente"})
        await s.pedir("PUT", f"/inscricoes/{ins['plantio_thiago']}/presenca",
                      "verdemar", json={"situacao": "ausente"})
        await s.pedir("POST", f"/atividades/{plantio}/finalizar", "verdemar")
        await s.pedir("PUT", f"/inscricoes/{ins['catalogacao_larissa']}/presenca",
                      "lagoa", json={"situacao": "presente"})
        await s.pedir("POST", f"/atividades/{catalogacao}/finalizar", "lagoa")
        linha("Plantio no Parque do Cocó", "finalizada, certificado da Larissa")
        linha("Mutirão de catalogação", "finalizada, certificado da Larissa")
        linha("Limpeza da Praia do Futuro", "aguardando validação da ONG")

        print("\nAcontecendo agora")
        mangue = await s.atividade(
            "verdemar", "Mutirão no mangue do Cocó",
            "Retirada de lixo preso nas raízes do mangue, de barco e a pé. Botas e "
            "luvas ficam por nossa conta.",
            "Ponte do Rio Cocó, Av. Sebastião de Abreu", 1, "08:00", "12:00")
        await s.inscrever("larissa", mangue)
        await s.inscrever("davi", mangue)
        await mover(mangue, 0, agora_ini, agora_fim)
        await s.checkin("verdemar", "davi", mangue)
        linha("Mutirão no mangue do Cocó", "em andamento; Davi já fez check-in")

        print("\nPróximas")
        compostagem = await s.atividade(
            "verdemar", "Oficina de compostagem",
            "Montagem de composteiras com baldes reaproveitados para a horta da "
            "escola municipal. Vagas limitadas: a ONG confirma cada inscrição.",
            "EMEF Professora Maria Felício, Sabiaguaba", 5, "08:00", "11:00",
            vagas=8, aprovacao=True)
        await s.inscrever("larissa", compostagem)
        await s.inscrever("bianca", compostagem)
        dunas = await s.atividade(
            "verdemar", "Trilha educativa nas dunas",
            "Acompanhar turmas do ensino fundamental na trilha das dunas de "
            "Sabiaguaba, explicando a fauna e a flora do caminho.",
            "Parque das Dunas de Sabiaguaba", 12, "07:00", "10:00", vagas=12)
        await s.inscrever("davi", dunas)
        historias = await s.atividade(
            "lagoa", "Contação de histórias",
            "Leitura em voz alta para crianças de 4 a 8 anos, seguida de uma "
            "atividade de desenho sobre a história do dia.",
            "Biblioteca Comunitária da Lagoa", 3, "09:00", "11:00", vagas=6)
        await s.inscrever("larissa", historias)
        reforco = await s.atividade(
            "lagoa", "Reforço de leitura, 5º ano",
            "Acompanhamento individual de alunos com dificuldade de leitura, em "
            "duplas de voluntário e criança.",
            "Biblioteca Comunitária da Lagoa", 9, "14:00", "17:00", vagas=2)
        await s.inscrever("bianca", reforco)
        await s.inscrever("thiago", reforco)
        marmitas = await s.atividade(
            "cozinha", "Preparo de marmitas",
            "Corte de legumes, preparo e montagem das marmitas da sexta-feira. "
            "Touca e avental fornecidos.",
            "Cozinha Solidária, Rua Três Corações, 120", 2, "07:00", "12:00",
            vagas=15)
        cancelada_larissa = await s.inscrever("larissa", marmitas)
        await s.pedir("POST", f"/inscricoes/{cancelada_larissa}/cancelar", "larissa")
        arrecadacao = await s.atividade(
            "cozinha", "Campanha de arrecadação",
            "Ponto de coleta de alimentos na entrada do supermercado, com "
            "abordagem aos clientes e registro das doações.",
            "Supermercado Pinheiro, Av. Osório de Paiva", 16, "08:00", "14:00",
            vagas=10, aprovacao=True)
        aprovada = await s.inscrever("larissa", arrecadacao)
        await s.pedir("POST", f"/inscricoes/{aprovada}/aprovar", "cozinha")
        linha("Oficina de compostagem", "com aprovação; 2 pedidos pendentes")
        linha("Trilha educativa nas dunas", "aberta")
        linha("Contação de histórias", "aberta")
        linha("Reforço de leitura, 5º ano", "lotada")
        linha("Preparo de marmitas", "aberta; Larissa cancelou")
        linha("Campanha de arrecadação", "com aprovação; Larissa aprovada")

        print("\nOutros estados")
        await s.atividade(
            "verdemar", "Feira de trocas de mudas",
            "Rascunho: falta confirmar o local com a prefeitura.",
            "A definir", 25, "08:00", "12:00", publicar=False)
        aves = await s.atividade(
            "verdemar", "Censo de aves do estuário",
            "Contagem de aves migratórias no estuário do Cocó com o grupo de "
            "observadores da UFC.",
            "Foz do Rio Cocó", 7, "05:30", "08:30")
        await s.pedir("POST", f"/atividades/{aves}/cancelar", "verdemar",
                      json={"motivo": "A maré prevista para o dia não permite o "
                                      "acesso à foz."})
        linha("Feira de trocas de mudas", "rascunho")
        linha("Censo de aves do estuário", "cancelada")

        print("\nSelo da ONG")
        admin = await http.post("/auth/entrar", json={
            "email": f"admin-demo@{DOMINIO}", "senha": SENHA})
        if admin.status_code == 200:
            s.tokens["admin"] = admin.json()["token"]
            await s.pedir("POST", f"/admin/ongs/{s.ids['verdemar']}/verificar", "admin")
            linha("Instituto Verde Mar", "verificada")
        else:
            linha("sem admin-demo local", "selo não concedido (opcional)")

    print("\nPronto. Senha de todas as contas: a de demonstrar_validacao.SENHA.\n")
    return 0


if __name__ == "__main__":
    analisador = argparse.ArgumentParser(description=__doc__)
    analisador.add_argument("--api", default="http://localhost:3000")
    argumentos = analisador.parse_args()
    if "maishoras" in argumentos.api:
        sys.exit("Este roteiro escreve no banco. Não aponte para produção.")
    sys.exit(asyncio.run(main(argumentos.api)))
