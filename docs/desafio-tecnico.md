# Desafio tecnológico — garantir que a hora complementar é verdadeira

Documento de defesa do projeto (trabalho de extensão). Explica qual é o problema difícil
que o Mais Horas resolve, o que já está implementado e qual é a evolução proposta.

## O problema

Fazer um CRUD de vagas de voluntariado é fácil. O problema difícil é outro:

> **Como provar que o aluno realmente esteve presente e que o certificado não foi forjado?**

Hoje, na maioria das faculdades, a comprovação de horas complementares é um PDF ou um papel
assinado. Ambos são triviais de editar. A coordenação não tem como verificar sem ligar para
a ONG, e ninguém faz isso em escala.

O Mais Horas ataca isso em três camadas.

## Camada 1 — Autenticidade do certificado (implementado)

Cada certificado recebe um `verification_code` único (coluna `UNIQUE` na tabela
`certificates`) e uma **página pública de verificação** acessível por QR Code.

```
PDF do certificado  ->  QR Code  ->  https://<site>/verificar/<code>
                                            |
                                            v
                              GET /api/certificates/validate/<code>
                                            |
                                            v
                          aluno, atividade, ONG, horas, data de emissão
```

Qualquer pessoa — coordenação do curso, faculdade, empregador — escaneia e confirma na
hora se o certificado é válido, de quem é, de qual atividade e quantas horas.
**A verificação não depende do PDF**, que pode ser editado; ela consulta o banco.

Detalhe de implementação relevante: a página de verificação é uma rota do **frontend**
(React), não HTML montado por string no backend. Isso elimina o risco de injeção que a
versão anterior tinha e permite uma página apresentável no celular de quem escaneia.

## Camada 2 — Verificação de presença (implementado, nível básico)

A presença é validada pela **ONG responsável** pela atividade (`role: organization`), e
somente presenças confirmadas (`status: present`) geram certificado.

Travas no fluxo:

- `UNIQUE(activity_id, user_id)` em `participations` — um aluno não se inscreve duas vezes
- `participation_id UNIQUE` em `certificates` — uma participação gera no máximo um certificado
- A atividade **não finaliza** enquanto houver participação com `status: pending` — ou seja,
  a ONG é obrigada a se posicionar sobre cada inscrito antes de emitir qualquer certificado

**Limitação honesta:** essa camada confia na ONG. Ela impede o aluno de forjar, mas não
impede um combinado entre aluno e ONG, nem cobre o caso do aluno que se inscreve, não vai,
e a ONG marca presença por engano ou por não ter controle da lista no dia.

## Camada 3 — Anti-fraude de presença com QR dinâmico (implementado)

É aqui que está o case de engenharia mais forte do projeto.

**O ataque que queremos impedir:** o aluno não vai ao evento, pede pro colega que foi tirar
um print do QR Code e mandar no WhatsApp, e faz o check-in de casa.

**A solução:** o QR exibido pela ONG no local **não é estático**. Ele rotaciona a cada poucos
segundos, e o token que ele carrega expira junto.

```
ONG abre a tela do evento
        |
        v
  gera token assinado (JWT curto)     <-- rotaciona a cada ~30s
  payload: { activityId, janela, nonce }
        |
        v
  renderiza QR na tela/projetor
        |
   aluno escaneia
        |
        v
  POST /api/participations/checkin { token }
        |
        v
  backend valida: assinatura ok? janela de tempo ainda vale? já usado?
        |
        v
  presença registrada com timestamp
```

**Tecnologias:**

- **Token assinado de curta duração** — `MH1.<atividade>.<janela>.<assinatura>`, com HMAC
  SHA-256 sobre `atividade:janela` usando um segredo exclusivo do check-in. Não dá para
  forjar sem o segredo. Atividade e janela viajam em claro de propósito: é o que permite
  responder "este código é de outra atividade" em vez de um "inválido" que não ajuda.
- **Janela de tempo estilo TOTP** — o token é derivado de `(atividade, segredo, tempo
  arredondado em 30 s)`. **Nada é gravado**: validar é recalcular. Não há tabela de
  tokens emitidos para crescer nem para limpar.
- **Expiração determinística** — a folga de trânsito é contada a partir do *fim* da
  janela, não da janela inteira. Assim o tempo de vida máximo é fixo (30 s de janela +
  10 s de folga = 40 s), em vez de variar entre 30 e 60 s conforme a hora de emissão.
- **Geolocalização opcional** — o check-in envia as coordenadas do celular e o backend
  compara com o local declarado da atividade, dentro de um raio de tolerância.

**Por que funciona:** quando o colega tira o print e manda no WhatsApp, o token daquele QR
já expirou — no máximo 40 segundos depois de aparecer na tela, sempre. Para fraudar, o aluno ausente precisaria de um cúmplice mandando um print novo
a cada 30 segundos em tempo real — o custo do ataque fica maior que o de simplesmente ir ao
evento. E com a checagem de geolocalização, nem isso basta.

**Trade-offs a assumir na apresentação:**

- Exige que a ONG tenha uma tela no local (celular já resolve)
- Exige internet no momento do check-in, dos dois lados
- Relógio dessincronizado entre servidor e cliente pede uma janela de tolerância
- Geolocalização de celular pode ser falsificada — por isso ela é uma camada extra, não a
  defesa principal

## Sobre o desafio de escala

Atrair muitas ONGs e divulgar a plataforma é um desafio real do projeto, mas é de
**produto e negócio**, não de engenharia. Vale citar na apresentação como próximo passo,
mas o QR dinâmico é o que sustenta uma discussão técnica de verdade.

## Resumo para a banca

| Camada | Status | O que garante |
|---|---|---|
| Certificado verificável por QR | Implementado | O documento não pode ser forjado nem editado |
| Validação de presença pela ONG | Implementado | Só quem a ONG confirmou recebe certificado |
| QR dinâmico rotativo | Proposto | O aluno precisa estar fisicamente no evento |
