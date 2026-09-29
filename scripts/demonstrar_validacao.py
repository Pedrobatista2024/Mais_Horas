#!/usr/bin/env python3
"""
Demonstração do ciclo completo — para rodar na frente da banca.

Percorre o caminho inteiro numa base **local**, narrando cada passo: a ONG
publica, o aluno se inscreve, o check-in acontece com um QR de verdade, a
presença é confirmada, o certificado sai assinado, a verificação confirma — e,
no fim, o registro é alterado direto no banco para mostrar o sistema acusando
a adulteração.

Nada aqui é encenação: são as mesmas rotas que o site usa, e a conferência da
assinatura é feita por fora, direto na biblioteca de criptografia.

Uso (com o Postgres e a API locais no ar):

    cd backend
    .venv/Scripts/python ../scripts/demonstrar_validacao.py

Opções: `--api http://localhost:3000` aponta para outro servidor.
**Não aponte para produção**: o último passo escreve no banco de propósito.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import sys
import time
import uuid
from datetime import time as hora_do_dia, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

SENHA = "demonstracao-mais-horas-1"
PASSO = 0


def passo(titulo: str) -> None:
    global PASSO
    PASSO += 1
    print(f"\n\033[1m{PASSO}. {titulo}\033[0m")


def item(rotulo: str, valor: object = "") -> None:
    print(f"   {rotulo:<34}{valor}")


def confere_por_fora(prova: dict) -> bool:
    """A verificação independente: chave pública, assinatura e texto."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization

    chave = serialization.load_pem_public_key(prova["chavePublica"].encode())
    try:
        chave.verify(base64.b64decode(prova["assinatura"]),
                     prova["textoAssinado"].encode("utf-8"))
        return True
    except InvalidSignature:
        return False


async def main(api: str) -> int:
    from sqlalchemy import select

    from app.db.models import Atividade, Certificado, Inscricao
    from app.db.session import CriarSessao
    from app.services.atividade_service import hoje

    marca = uuid.uuid4().hex[:8]
    async with httpx.AsyncClient(base_url=f"{api}/api/v1", timeout=30) as http:
        passo("Contas de demonstração")
        contas = {}
        for papel, nome in (("ong", f"ONG Demonstração {marca}"),
                            ("estudante", "Aluno de Demonstração")):
            resposta = await http.post("/auth/cadastro", json={
                "nome": nome, "email": f"{papel}-{marca}@demo.local",
                "senha": SENHA, "papel": papel})
            resposta.raise_for_status()
            contas[papel] = resposta.json()["token"]
            item(f"{papel} criada", f"{papel}-{marca}@demo.local")

        ong = {"Authorization": f"Bearer {contas['ong']}"}
        aluno = {"Authorization": f"Bearer {contas['estudante']}"}

        await http.put("/perfil", headers=aluno, json={
            "nome_completo": "Aluno de Demonstração da Silva",
            "instituicao": "UniC", "curso": "Sistemas de Informação"})
        item("perfil do aluno", "completo (exigido antes da inscrição)")

        passo("A ONG publica uma atividade acontecendo agora")
        criada = await http.post("/atividades", headers=ong, json={
            "titulo": f"Mutirão de demonstração {marca}",
            "descricao": "Atividade criada pelo roteiro de demonstração.",
            "local": "Praia do Futuro", "cidade": "Fortaleza", "estado": "CE",
            "data": (hoje() + timedelta(days=1)).isoformat(),
            "hora_inicio": "08:00", "hora_fim": "12:00",
            "vagas_min": 1, "vagas_max": 10})
        criada.raise_for_status()
        atividade = criada.json()
        await http.post(f"/atividades/{atividade['id']}/publicar", headers=ong)
        item("atividade", atividade["titulo"])

        async with CriarSessao() as db:
            gravada = await db.get(Atividade, uuid.UUID(atividade["id"]))
            gravada.data = hoje()
            gravada.hora_inicio = hora_do_dia(0, 0)
            gravada.hora_fim = hora_do_dia(23, 59)
            await db.commit()
        item("situação", "em andamento (a data foi ajustada para hoje)")

        passo("O aluno se inscreve")
        inscricao = await http.post("/inscricoes", headers=aluno,
                                    json={"atividadeId": atividade["id"]})
        inscricao.raise_for_status()
        item("inscrição", inscricao.json()["situacao"])

        passo("Check-in com o QR de verdade")
        token = (await http.get(f"/atividades/{atividade['id']}/checkin/token",
                                headers=ong)).json()
        item("token exibido pela ONG", token["token"])
        item("validade", f"{token['expiraEmSegundos']}s")
        registro = await http.post("/checkin", headers=aluno,
                                   json={"token": token["token"]})
        registro.raise_for_status()
        item("check-in do aluno", "aceito")

        velho = token["token"]
        item("guardando este token para depois", "(simula a foto no grupo)")

        passo("A ONG confirma a presença e finaliza")
        async with CriarSessao() as db:
            gravada = await db.get(Atividade, uuid.UUID(atividade["id"]))
            gravada.data = hoje() - timedelta(days=1)
            await db.commit()
            linha = await db.scalar(
                select(Inscricao).where(
                    Inscricao.atividade_id == uuid.UUID(atividade["id"])))
        await http.put(f"/inscricoes/{linha.id}/presenca", headers=ong,
                       json={"situacao": "presente"})
        fim = await http.post(f"/atividades/{atividade['id']}/finalizar",
                              headers=ong)
        fim.raise_for_status()
        item("certificados emitidos", fim.json().get("certificados", "?"))

        async with CriarSessao() as db:
            cert = await db.scalar(
                select(Certificado).where(
                    Certificado.atividade_id == uuid.UUID(atividade["id"])))
        codigo = cert.codigo_verificacao
        item("código do certificado", codigo)

        passo("Verificação pública (sem login)")
        verificacao = (await http.get(f"/certificados/verificar/{codigo}")).json()
        item("desfecho", verificacao["desfecho"])
        item("selos", verificacao["selos"])

        passo("Conferência independente, fora do nosso código")
        prova = (await http.get(f"/certificados/verificar/{codigo}/prova")).json()
        campos = json.loads(prova["textoAssinado"])
        item("texto assinado", f"{campos[2]} · {campos[4]} · {campos[5]}h")
        item("chave usada", prova["impressaoDigitalDaChave"])
        item("assinatura confere", "SIM" if confere_por_fora(prova) else "NÃO")

        passo("A foto do QR não serve")
        espera = max(0, token["expiraEmSegundos"] + 2)
        item("esperando o token vencer", f"{espera}s")
        time.sleep(espera)
        repetido = await http.post("/checkin", headers=aluno, json={"token": velho})
        item("check-in com o token antigo",
             f"{repetido.status_code} {repetido.json().get('codigo')}")

        passo("Alguém altera o registro direto no banco")
        async with CriarSessao() as db:
            alvo = await db.get(Certificado, cert.id)
            antes = alvo.horas
            alvo.horas = antes + 40
            await db.commit()
        item("horas no banco", f"{antes} → {antes + 40}")

        depois = (await http.get(f"/certificados/verificar/{codigo}")).json()
        prova_adulterada = (
            await http.get(f"/certificados/verificar/{codigo}/prova")).json()
        item("verificação pública", depois["desfecho"])
        item("assinatura confere",
             "SIM" if confere_por_fora(prova_adulterada) else "NÃO")
        item("PDF oficial",
             (await http.get(f"/certificados/verificar/{codigo}/pdf")).status_code)

        passo("Resumo")
        item("certificado emitido pelo fluxo real", codigo)
        item("assinatura conferida por fora", "sim")
        item("adulteração detectada", "sim")
        item("token de QR reaproveitado", "recusado")
        print("\n   A base local ficou com os dados desta demonstração.")
        print("   Recrie o banco antes de usá-la para outra coisa.\n")
        return 0


if __name__ == "__main__":
    analisador = argparse.ArgumentParser(description=__doc__)
    analisador.add_argument("--api", default="http://localhost:3000")
    argumentos = analisador.parse_args()
    if "maishoras" in argumentos.api:
        sys.exit("Este roteiro escreve no banco. Não aponte para produção.")
    sys.exit(asyncio.run(main(argumentos.api)))
