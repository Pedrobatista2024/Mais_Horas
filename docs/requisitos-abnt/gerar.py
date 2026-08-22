"""Monta o PDF final do documento de requisitos."""
from documento import Documento
import conteudo as c1
import conteudo2 as c2

import pathlib

# Escreve direto em presentation/ para nao existir copia divergente do PDF.
SAIDA = str(pathlib.Path(__file__).resolve().parents[2]
           / "presentation" / "Mais_Horas_Documento_de_Requisitos.pdf")

historia = []
historia += c1.capa()
historia += c1.folha_rosto()
historia += c1.sumario()
historia += c1.introducao()
historia += c1.objetivos()
historia += c1.metodologia()
historia += c1.escopo()
historia += c1.atores()
historia += c1.requisitos_funcionais()
historia += c1.requisitos_nao_funcionais()
historia += c1.regras_negocio()
historia += c2.casos_uso()
historia += c2.fluxos()
historia += c2.modelagem()
historia += c2.estados()
historia += c2.interfaces()
historia += c2.arquitetura()
historia += c2.seguranca()
historia += c2.consideracoes()
historia += c2.referencias()

doc = Documento(SAIDA)
doc.multiBuild(historia)
print("gerado:", SAIDA)
