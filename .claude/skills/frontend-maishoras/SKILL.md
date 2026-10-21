---
name: frontend-maishoras
description: Convenções de frontend do projeto Mais Horas (React + Vite + Mantine v8). Use ao criar ou editar qualquer tela, componente ou estilo do frontend em frontend/src — para manter paleta, componentes reutilizáveis, responsividade e padrões consistentes.
---

# Frontend — Mais Horas

Plataforma que conecta **estudantes** e **ONGs**: ONGs publicam vagas de voluntariado,
estudantes se inscrevem para cumprir horas de extensão, a presença gera certificado
validável por QR Code.

Stack: **React 19 + Vite + Mantine v8** (`@mantine/core`, `/hooks`, `/form`, `/dates`,
`/notifications`) + `@tabler/icons-react` + IBM Plex (`@fontsource`). Sem Tailwind.

## Identidade em três regras

1. **Azul royal é ação e marca. Âmbar é hora, e só hora.** Carga horária de vaga, horas
   de certificado e o total da caderneta usam `<Horas />`. Nenhum outro elemento é âmbar:
   situação, alerta e botão usam outras cores. Se aparecer âmbar fora de hora, a cor deixa
   de dizer alguma coisa.
2. **IBM Plex Sans é a voz.** Plex Mono só para código de verdade (código do certificado,
   código de check-in), aplicado no `input` (`styles={{ input: { fontFamily: … } }}`) e
   nunca com `ff` no campo inteiro, que vaza para o rótulo.
3. **Estrutura é informação.** Fio, coluna, número e rótulo só entram quando dizem algo.
   Passo numerado só onde a ordem importa; cartão só para objeto que se escolhe (vaga,
   ONG); lista de trabalho é linha.

## Portal público: linguagem de apresentação

O portal (páginas públicas) fala diferente da área logada:

- Abertura com foto de gente ocupando a largura (`portal/AberturaComFoto`), véu azul do
  lado do texto e, quando faz sentido, um cartão branco flutuando (`.mh-cartao-flutuante`).
- Títulos em Fraunces (`className="mh-serif"`); o corpo continua em IBM Plex.
- Seções alternam fundo com `<Secao fundo="azul" | "noite">`; cartões de canto 16–20px
  (`.mh-recurso`), botão grande `.mh-botao-portal`.
- Peças prontas: `BuscaDeVagas`, `Comparativo`, `CelularDeExemplo`, `PerguntasFrequentes`,
  `ChamadaFinal` (azul-noite).
- Fotos em `public/portal/`, com origem e licença em `LEIA-ME.md`. Foto nova: registre lá.

A área logada continua ferramenta: sem Fraunces, sem foto, cantos de 8px.

## O que não fazer (cara de modelo pronto)

- Palavra do título destacada em outra cor.
- Rótulo pequeno colorido acima de cada título ("eyebrow"). O menu já diz onde se está.
- `→` grudado no texto de link ou botão.
- Fileira de cartões iguais com ícone em quadrado colorido e número grande.
- Metadados unidos por " · ". Separe em colunas, linhas ou frases.
- Caixa alta em rótulo (`tt="uppercase"`).
- Botão desabilitado para mostrar situação ("Aguardando aprovação"). Situação é texto.
- Travessão (— ou –) em texto de tela. Use vírgula, dois-pontos ou ponto.
- `(s)`, `(ões)`, `(a)`: escreva o plural certo com uma condição.
- "..." em vez de "…" nos textos de carregamento.

## Componentes (reaproveite antes de criar)

- `ui/PageHeader` — título, `subtitle`, `action`, `badge` (um nó) e `voltar={{ para, rotulo }}`
  para quem desce um nível. Também define o título da aba (`useTitulo`).
- `ui/Horas` — a carga horária em âmbar (`valor`, `sufixo`).
- `ui/DataBloco` — data em bloco na frente das linhas de atividade ("sáb / 24 / out").
- `ui/Numeros` — fileira de números com fio entre eles; no celular vira linhas.
- `ui/SecaoDeFormulario` — bloco de formulário: título e explicação à esquerda, campos à
  direita (perfil, formulário de atividade).
- `ui/EmptyState` (`compacto` para dentro de seção), `ui/Loading`, `ui/ConfirmarAcao`
  (`rotuloVoltar` para dizer o que "voltar" mantém).
- `ui/BrandMark` / `ui/ClockGlyph` — logotipo.
- `atividade/CartaoAtividade` — vaga na vitrine; `para` torna o cartão inteiro um link.
- `atividade/LinhaAtividade` — atividade em colunas para a ONG; uma ação visível e o resto
  no menu; `comSituacao={false}` quando a lista já é de uma situação só.
- `atividade/BotaoInscricao` — decide o botão pelo estado do servidor; `compacto` no cartão.
- `certificado/Caderneta` — horas por certificado, total com traço duplo.
- `painel/Destaque` — a ação mais urgente; não é desenhado quando não há nada urgente.
- `portal/*` — `Secao` (título à esquerda, `nevoa`), `Passo`, `CartaoOng`,
  `ExemplarCertificado`, `ChamadaFinal`, `PaginaDePublico`.
- `auth/BotoesExternos` — Google, Microsoft e GitHub, só os configurados no servidor.

## Layouts

- `PainelLayout` (área logada): o conteúdo vive em `.mh-pagina` (1120px, margens
  responsivas). **Página não define `maw`/`mx` no topo**: é o layout que alinha todas.
  Formulário e páginas de foco estreitam por dentro (`<Box maw={…}>`), alinhadas à esquerda.
- `PortalLayout` (público): `Container size={LARGURA_DO_PORTAL}` de `portal/navegacao.js`.
- `AuthLayout` (acesso): formulário à esquerda, certificado de exemplo à direita no
  computador.
- `PublicPage` (verificação): topo mínimo, 760px.

## Classes de `src/index.css`

- Tokens em `:root`: `--mh-tinta`, `--mh-tinta-2`, `--mh-tinta-3`, `--mh-royal`,
  `--mh-hora*`, `--mh-nevoa`, `--mh-linha`, `--mh-linha-forte`, `--mh-foco`.
- `.mh-bloco` (superfície com fio), `.mh-lista` + `.mh-linha` (lista em linhas;
  `data-clicavel` dá hover e cursor), `.mh-link-titulo` (link que cobre o bloco; o que
  precisa continuar clicável por cima leva `.mh-acima-do-link`).
- `.mh-num` (dígitos tabulares), `.mh-horas`, `.mh-data`, `.mh-caderneta`, `.mh-numeros`.
- `.mh-abas-rolam` (abas que rolam de lado no celular), `.mh-secao`, `.mh-hero`,
  `.mh-exemplar`, `.mh-footer`, `.mh-qr`.

## Cor e contraste

- Tema em `src/theme.js`. `brand` 7 = `#1839b0`; `gray`/`ink` são cinzas azulados e
  `gray.6` (o `dimmed`) dá 5,5:1 sobre branco.
- Selo "light" do Mantine tinha texto claro demais (2,5:1 no verde); `variaveisDoTema()`
  escurece o texto de cada cor. Cor nova de selo: meça o contraste no navegador antes.
- Situações: rascunho cinza, publicada azul, acontecendo verde, a validar violeta,
  finalizada verde-azulado, cancelada vermelha.

## Dados e feedback

- `useFetch(url)` para GET simples, `useListagem(url, params)` para listas paginadas,
  `useConsultaPublica(url)` no portal. Filtro é do servidor.
- Filtros e abas que valem guardar ficam na URL (`useSearchParams`).
- Sempre `<Loading />` e `<EmptyState />`. Erro de API: `notifyError(mensagemDoErro(…))`.
  Sem toast de boas-vindas: a tela seguinte já recebe a pessoa.
- Datas: `formatDate`, `formatDateLong`, `formatDataCurta`, `formatHorario` ("8h às 11h")
  de `utils/format`. Nunca `new Date("2026-09-20")` direto.

## Responsividade (obrigatório)

- Teste em 375px e em 1440px. Para olhar tudo de uma vez, rode `scripts/semear_local.py`
  numa base local e fotografe as telas.
- Campos têm 16px no celular (o CSS global cuida disso); não reduza.
- `SimpleGrid` com colunas por breakpoint; `Group wrap="wrap"` onde pode estourar.
- Tabela larga do console: `Table.ScrollContainer` e colunas secundárias com
  `visibleFrom`.

## Antes de finalizar

- `npx eslint src` e `npm run build` limpos.
- Abrir no navegador (Vite em :5173, API em :3000) as telas mexidas, nas duas larguras.
