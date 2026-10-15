# Gerador do Documento de Requisitos (ABNT)

Scripts que produzem [`presentation/Mais_Horas_Documento_de_Requisitos.pdf`](../../presentation/Mais_Horas_Documento_de_Requisitos.pdf),
o documento acadêmico entregue no Projeto Integrador I.

O PDF é **gerado**, não editado à mão. Para mudar qualquer texto, altere o script
correspondente e rode de novo — assim o documento nunca diverge da fonte.

## Rodar

```bash
cd docs/requisitos-abnt && ../../backend/.venv/Scripts/python gerar.py
```

Depende apenas de `reportlab`, já presente no ambiente do backend.

O documento sai **sem folha de rosto**: logo depois da capa, ela parecia uma capa
repetida. A NBR 14724 a pede; se a avaliação cobrar, basta devolver
`c1.folha_rosto()` em `gerar.py`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `documento.py` | Formatação ABNT: margens 3-2-3-2 cm, Times 12, entrelinha 1,5, recuo 1,25 cm, paginação a partir da introdução, sumário automático |
| `diagramas.py` | Os oito diagramas, desenhados por código: casos de uso, DER principal e de apoio, fluxo do processo, entrada por provedor externo, implantação e as duas máquinas de estado |
| `conteudo.py` | Pré-textuais e seções 1 a 8 |
| `conteudo2.py` | Seções 9 a 16 e referências |
| `gerar.py` | Monta tudo e escreve o PDF |

## Relação com os demais documentos

Este documento é a **versão acadêmica** do desenho registrado em
[especificacao.md](../especificacao.md), [fluxos.md](../fluxos.md),
[modelo-dados.md](../modelo-dados.md) e [contrato-api.md](../contrato-api.md).

Os documentos técnicos são a fonte da verdade para quem implementa; este PDF é a
apresentação do mesmo desenho para a banca, em registro acadêmico. Ao mudar uma regra
de negócio, atualize os dois.
