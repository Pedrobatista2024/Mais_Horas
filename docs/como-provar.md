# Como provar que funciona

Roteiro para demonstrar, na frente de quem quiser conferir, que o certificado e a
presença do Mais Horas são validáveis de verdade — e não uma tela dizendo "válido".

A pergunta que este documento responde é: **por que acreditar nessa validação?**
A resposta curta: você não precisa acreditar. Dá para refazer a conta por fora.

---

## O que sustenta cada afirmação

| Afirmação | O que a sustenta | Como conferir |
|---|---|---|
| "Este certificado é autêntico" | Assinatura Ed25519 sobre os dados impressos | Verificador independente, abaixo |
| "Ninguém alterou o registro" | A assinatura cobre nome, organização, atividade, horas, data e emissão | Alterar qualquer campo quebra a conferência |
| "A pessoa esteve no evento" | QR que muda a cada 30 s, validado no servidor | Foto do QR repassada é recusada |
| "A ONG confirmou" | Presença é decisão da organização, registrada com autor e horário | Trilha de auditoria no console |

---

## 1. A demonstração de 5 minutos, ao vivo

Precisa do Postgres e da API locais no ar.

```bash
cd backend
.venv/Scripts/python ../scripts/demonstrar_validacao.py
```

O roteiro percorre o ciclo inteiro narrando cada passo: cria as contas, publica a
atividade, o aluno se inscreve, chega o dia, acontece o **check-in com um QR real**, a ONG
confirma a presença, o certificado é emitido, a verificação pública confirma, a assinatura
é conferida **fora do nosso código**, o QR antigo é recusado e, no fim, o registro é
alterado direto no banco para mostrar a detecção — e depois **restaurado**, mostrando a
verificação voltar a conferir.

Esse último par é o que fecha o argumento: a detecção é sobre o dado, não uma marca que
alguém colocou no registro.

Ele leva cerca de 50 segundos, quase tudo esperando o QR vencer. Ao final, imprime o
código do certificado pronto para a conferência independente do passo 2.

> Ele escreve no banco de propósito. Rode só na base local.

---

## 2. A conferência independente, na máquina de quem duvida

É o argumento mais forte: a validação não depende do nosso site.

```bash
pip install cryptography
python scripts/verificar_certificado.py a1b2c3d4e5f60718
```

Saída:

```
  Certificado  a1b2c3d4e5f60718
  Aluno        Maria Silva Souza
  Organização  ONG Verde Vida
  Atividade    Mutirão de limpeza na Praia do Futuro
  Data         2026-09-20
  Carga        4h

  ASSINATURA CONFERE
  Os dados acima são exatamente os que foram assinados na emissão.
```

Para provar que funciona **offline**, salve a prova e desligue a internet:

```bash
python scripts/verificar_certificado.py CODIGO --salvar prova.json
python scripts/verificar_certificado.py --arquivo prova.json
```

Para mostrar que não é teatro, edite uma letra do `textoAssinado` dentro do `prova.json` e
rode de novo: a resposta vira **ASSINATURA NÃO CONFERE**. O script sai com código `0`
quando confere e `1` quando não — dá para usar em automação.

O que o script faz cabe em três linhas: carrega a chave pública, pega o texto assinado e
pede à biblioteca de criptografia que confira a assinatura. Nenhum dos nossos serviços
participa da conta.

---

## 3. Pela tela, sem terminal

Na página de verificação (`/verificar/<código>`), o bloco **"Conferir por conta própria"**
mostra o texto assinado, a assinatura e o link da chave pública, com botões de copiar.
Quem quiser confere em qualquer ferramenta que valide Ed25519.

A chave pública fica aberta em `GET /api/v1/portal/chave-publica`, e sua impressão digital
é impressa no rodapé de todo certificado — é assim que se confirma que a chave baixada é a
mesma que assinou aquele papel.

---

## 4. Mostrando que a adulteração é detectada

Com acesso ao banco local, o caminho mais direto:

```sql
UPDATE certificados SET horas = horas + 40 WHERE codigo_verificacao = 'CODIGO';
```

Depois disso, na mesma página de verificação:

- o desfecho vira **"Este certificado não confere"**;
- o verificador independente responde **ASSINATURA NÃO CONFERE**;
- o **PDF oficial deixa de ser gerado** — imprimir um registro adulterado com o timbre da
  plataforma seria entregar ao fraudador o documento que ele queria;
- a tentativa entra na trilha de auditoria como `integridade.verificada`.

O console do administrador também tem **"Verificar integridade"**, que recalcula a
assinatura de todos os certificados de uma vez e lista os divergentes.

---

## 5. Mostrando que a presença não se falsifica

1. Abra o painel de check-in de uma atividade em andamento (tela da ONG).
2. Fotografe o QR — ou copie o código exibido abaixo dele.
3. Espere passar **40 segundos** (30 da janela + 10 de folga).
4. Tente o check-in com aquele código: a resposta é `checkin_fora_da_janela`.

O código não é guardado em lugar nenhum: validar é **recalcular** a partir da atividade, do
segredo do servidor e da janela de tempo. Não existe lista de códigos para vazar, e um
código velho não volta a valer.

> **O que isto prova e o que não prova.** Prova que quem fez o check-in tinha um código
> gerado naquele minuto. Não prova, sozinho, presença física: alguém no local poderia
> repassar o código por mensagem em tempo real. Por isso a presença final é **decisão da
> ONG** (RN-23), e o check-in entra como evidência, com origem (QR ou manual) e horário.
> A divergência entre os dois é justamente o que a auditoria permite investigar.

---

## 6. O que ainda não temos — e vale dizer antes que perguntem

- **A assinatura é nossa, não de uma autoridade certificadora.** Ela prova que o documento
  saiu deste sistema e não foi alterado. Não tem, hoje, valor jurídico de ICP-Brasil —
  isso exigiria um certificado e-CNPJ pago, em nome da instituição.
- **O PDF não é assinado no padrão PAdES.** A assinatura protege os dados do certificado,
  não o arquivo. Um PDF editado continua sendo detectado, porque a verificação compara com
  o registro assinado — mas o Adobe Reader não exibe o selo de "documento assinado".
- **Geolocalização no check-in está desligada.** As coordenadas são gravadas quando o
  navegador as envia, mas não são comparadas com o local da atividade.

Os três são caminhos abertos, não defeitos escondidos: estão aqui para serem citados antes
de virarem pergunta.
