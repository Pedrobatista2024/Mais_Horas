# Scripts

Ferramentas de apoio à apresentação do projeto. Não fazem parte da aplicação.

## O que tem aqui

| Arquivo | O que faz |
|---|---|
| `rebuild_visual_presentation.py` | Reconstrói visualmente o PDF da apresentação, redesenhando os slides |
| `adjust_presentation_pdf.py` | Aplica ajustes pontuais sobre o PDF já gerado |
| `generate-maishoras-presentation.ps1` | Gerador original em PowerShell, anterior aos dois acima |

## Dependências

Os dois scripts Python precisam de:

```bash
pip install pymupdf pillow
```

`pymupdf` é importado como `fitz`, e `pillow` como `PIL` — os nomes de instalação e de
importação não coincidem, o que costuma confundir na primeira vez.

## Limitação: caminhos fixos

> **Estes scripts só rodam na máquina do Ismael.** Ambos apontam para um PDF de origem
> por caminho absoluto:
>
> ```python
> SOURCE_PDF = Path(r"C:\Users\ismae\OneDrive\Documents\apresen-final23062026.pdf")
> ```
>
> Esse arquivo **não está no repositório** — vive em `Documents/`, fora do projeto. Quem
> clonar o repositório não consegue executá-los.

Para torná-los utilizáveis pelo grupo, seriam necessárias duas mudanças: receber o caminho
do PDF por argumento de linha de comando, em vez de constante no código; e definir onde o
arquivo de origem deve morar, já que versionar um PDF de 7 MB no repositório também não é
ideal.

Estão versionados como estão porque representam trabalho real que, de outra forma,
existiria apenas em um disco. A portabilidade fica como melhoria futura.

## Relação com o documento de requisitos

Não confundir com [`docs/requisitos-abnt/`](../docs/requisitos-abnt/), que gera o
**Documento de Requisitos** em ABNT. Aquele é autocontido: não depende de arquivo externo e
roda em qualquer máquina com o ambiente do backend.
