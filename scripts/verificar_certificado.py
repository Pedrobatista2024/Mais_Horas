#!/usr/bin/env python3
"""
Verificador independente de certificado do Mais Horas.

Confere a assinatura digital **sem depender do site**: baixa a prova pública
(ou lê um arquivo salvo), refaz a conta com a chave pública e diz se o
documento é autêntico. Quem roda isto não precisa acreditar na nossa resposta
— só na matemática.

Precisa de uma coisa só: a biblioteca `cryptography`.

    pip install cryptography

Uso:

    # conferindo pelo código impresso no certificado
    python verificar_certificado.py a1b2c3d4e5f60718

    # guardando a prova para conferir depois, offline
    python verificar_certificado.py a1b2c3d4e5f60718 --salvar prova.json
    python verificar_certificado.py --arquivo prova.json

    # apontando para outro servidor
    python verificar_certificado.py CODIGO --api https://exemplo.com

Saída: 0 se a assinatura confere, 1 se não confere, 2 em caso de erro.
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import urllib.error
import urllib.request

API_PADRAO = "https://maishoras.northcentralus.cloudapp.azure.com"


def baixar_prova(api: str, codigo: str) -> dict:
    url = f"{api.rstrip('/')}/api/v1/certificados/verificar/{codigo}/prova"
    try:
        with urllib.request.urlopen(url, timeout=20) as resposta:
            return json.loads(resposta.read())
    except urllib.error.HTTPError as erro:
        if erro.code == 404:
            sys.exit(f"Nenhum certificado com o código {codigo}.")
        sys.exit(f"O servidor respondeu {erro.code}.")
    except urllib.error.URLError as erro:
        sys.exit(f"Não consegui falar com {api}: {erro.reason}")


def conferir(prova: dict) -> bool:
    """A verificação em si: assinatura Ed25519 sobre o texto assinado."""
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import serialization

    chave = serialization.load_pem_public_key(prova["chavePublica"].encode())
    try:
        chave.verify(base64.b64decode(prova["assinatura"]),
                     prova["textoAssinado"].encode("utf-8"))
        return True
    except InvalidSignature:
        return False


def mostrar(prova: dict, confere: bool) -> None:
    (versao, codigo, nome, organizacao, atividade, horas, data,
     emitido) = json.loads(prova["textoAssinado"])

    print()
    print("  Certificado ", codigo)
    print("  Aluno       ", nome)
    print("  Organização ", organizacao)
    print("  Atividade   ", atividade)
    print("  Data        ", data)
    print("  Carga       ", f"{horas}h")
    print("  Emissão     ", f"{emitido} (segundos UTC)")
    print("  Formato     ", versao)
    print("  Chave       ", prova["impressaoDigitalDaChave"])
    print()

    if not confere:
        print("  ASSINATURA NÃO CONFERE")
        print("  Os dados acima não correspondem à assinatura. O registro foi")
        print("  alterado depois da emissão — não aceite como comprovação.")
        return

    print("  ASSINATURA CONFERE")
    print("  Os dados acima são exatamente os que foram assinados na emissão.")
    if prova.get("revogado"):
        print()
        print("  ATENÇÃO: este certificado foi REVOGADO pela instituição.")
        print("  A assinatura continua válida — o que mudou foi a decisão de")
        print("  quem emitiu. Não vale como comprovação de horas.")


def main() -> int:
    analisador = argparse.ArgumentParser(
        description="Confere a assinatura de um certificado do Mais Horas.")
    analisador.add_argument("codigo", nargs="?",
                            help="código de 16 caracteres impresso no certificado")
    analisador.add_argument("--api", default=API_PADRAO,
                            help=f"servidor a consultar (padrão: {API_PADRAO})")
    analisador.add_argument("--arquivo",
                            help="confere uma prova já salva, sem acessar a rede")
    analisador.add_argument("--salvar",
                            help="salva a prova baixada neste arquivo")
    argumentos = analisador.parse_args()

    if argumentos.arquivo:
        with open(argumentos.arquivo, encoding="utf-8") as arquivo:
            prova = json.load(arquivo)
    elif argumentos.codigo:
        prova = baixar_prova(argumentos.api, argumentos.codigo.strip())
        if argumentos.salvar:
            with open(argumentos.salvar, "w", encoding="utf-8") as arquivo:
                json.dump(prova, arquivo, ensure_ascii=False, indent=2)
            print(f"Prova salva em {argumentos.salvar}")
    else:
        analisador.error("informe o código do certificado ou --arquivo")

    confere = conferir(prova)
    mostrar(prova, confere)
    return 0 if confere else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(2)
