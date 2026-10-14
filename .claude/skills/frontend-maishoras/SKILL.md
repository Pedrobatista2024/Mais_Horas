---
name: frontend-maishoras
description: Convenções de frontend do projeto Mais Horas (React + Vite + Mantine v8). Use ao criar ou editar qualquer tela, componente ou estilo do frontend em frontend/src — para manter paleta, componentes reutilizáveis, responsividade e padrões consistentes.
---

# Frontend — Mais Horas

Plataforma que conecta **estudantes** e **ONGs**: ONGs publicam vagas de voluntariado,
estudantes se inscrevem para cumprir horas complementares, a presença gera certificado
validável por QR Code.

Stack: **React 19 + Vite + Mantine v8** (`@mantine/core`, `/hooks`, `/form`, `/dates`,
`/notifications`) + `@tabler/icons-react`. Sem Tailwind. Sem CSS-in-JS além do tema.

## Regras essenciais

1. **Sempre Mantine.** Não escrever HTML cru estilizado com `style` inline solto.
   Use componentes Mantine (`Paper`, `Card`, `Group`, `Stack`, `SimpleGrid`, `Button`,
   `Text`, `Title`, `Badge`, `ThemeIcon`, etc.) e props do sistema (`p`, `mt`, `gap`, `c`).
2. **Reaproveite os componentes existentes** antes de criar novos:
   - `ui/PageHeader` — cabeçalho de página (`eyebrow`, `title`, `subtitle`, `action`)
   - `ui/StatCard` — cartão de métrica (`icon`, `label`, `value`, `color`, `helper`)
   - `ui/ActionCard` — cartão de ação com botão (`icon`, `title`, `description`, `actionLabel`)
   - `ui/EmptyState` — estado vazio (`icon`, `title`, `description`, `action`)
   - `ui/Loading` — spinner centralizado (`label`)
   - `ui/ConfirmarAcao` — modal de confirmação, com motivo obrigatório quando preciso
   - `ui/BrandMark` / `ui/BrandIcon` — logo "MaisHoras"
   - `atividade/CartaoAtividade` — cartão de atividade, para a **vitrine** (`atividade`, `rodape`, `aoClicar`)
   - `atividade/LinhaAtividade` — atividade como **linha**, para quem administra: uma ação
     visível (`acao`) e o resto no menu (`menu`). Vai dentro de um `Box className="mh-lista"`
   - `atividade/SituacaoBadge` — selo da situação da atividade
   - `atividade/BotaoInscricao` — decide sozinho o botão a partir do estado do servidor
   - `painel/Destaque` — faixa da ação mais urgente em E1 e O1
   - `portal/` — peças das páginas públicas (`Secao`, `CartaoOng`, `ChamadaFinal`…)
   - `auth/BotoesExternos` — entrada por Google, Microsoft e GitHub; só mostra o provedor
     que o servidor tem configurado (`acao="Criar conta"` muda o texto)
3. **Layouts:** `PainelLayout` (área logada, AppShell + navbar), `PortalLayout` (portal
   público), `AuthLayout` (login/registro), `PublicPage` (verificação de certificado).
4. **Dados:** `useFetch(url)` para GET simples, `useListagem(url, params)` para listas
   paginadas com filtro do servidor, `useConsultaPublica(url)` nas páginas do portal.
   Mutations via `api` de `src/services/api`. Sempre trate `loading` com `<Loading />` e
   listas vazias com `<EmptyState />`.
5. **Feedback:** use `notifySuccess` / `notifyError` de `src/utils/notify` (toasts Mantine).
   Nunca `alert()`. Erros de API: `notifyError(err, "mensagem fallback")`.
6. **Datas:** `formatDate(iso)` de `src/utils/format`. Imagens: `resolveImage(photo, photoUrl)`.
   Iniciais de avatar: `initials(nome)`.

## Paleta (tema em src/theme.js)

- `brand` (azul royal, primária, `primaryShade` 7 `#1839b0`) — ações principais, identidade
- `navy` (azul escuro, shade 7 `#21397e`) — área/itens da ONG
- `clay` (âmbar, shade 6 `#ef9504`) — destaque secundário (badge de carga horária, CTA do portal)
- `ink` (cinza-azulado) — textos/neutros
- Texto secundário: `c="dimmed"`.

## Tom visual: ferramenta sóbria

A interface foi refeita para **não** ter cara de modelo pronto. Mantenha:

- **Cor marca estado e ação, não enfeite.** Número de `StatCard` não leva cor; botão
  secundário é `variant="default"`; uma ação principal por tela.
- **Pesos 600 e 700.** Nada de `fw={800}`/`900`. Títulos de página vêm do tema (`Title order={1}`).
- **Rótulo acima do título é discreto:** `<Text size="xs" c="dimmed">`. Sem caixa alta
  colorida em cima de cada título — é o que faz todas as telas parecerem a mesma.
- **Raio médio** (o padrão do tema). `radius="lg"`/`"xl"` só em avatar redondo.
- **Lista de gestão é linha, não cartão.** Cartão com pilha de botões vira parede; use
  `LinhaAtividade` / `.mh-lista` + `.mh-linha`.
- **Sem gradiente, sombra grande ou cartão flutuando** sobre foto.

## Classes CSS utilitárias (src/index.css)

- `.mh-page-band` — superfície de conteúdo (cartão grande de página)
- `.mh-card-hover` — hover discreto (borda e fundo) em cartões clicáveis
- `.mh-lista` / `.mh-linha` / `.mh-linha-seta` — lista em linhas com borda única
- `.mh-topbar`, `.mh-sidebar`, `.mh-main`, `.mh-app-shell` — chrome do AppShell
- `.mh-auth-page`, `.mh-public-page` — fundo das páginas públicas
- `.mh-nav-button[data-active]` — item de navegação

## Responsividade (obrigatório)

A maioria dos estudantes acessa por celular. Sempre:
- `SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}` em vez de colunas fixas
- Padding responsivo: `p={{ base: "lg", sm: "xl" }}`
- `Group` com `wrap="wrap"` quando houver risco de estouro
- Testar em 375px de largura
- **Página de conteúdo estreito centraliza**: `maw={1040} mx="auto" w="100%"` no `Stack`
  raiz. Sem o `mx`, o conteúdo encosta à esquerda e sobra meia tela vazia em 1920px
- Campo curto não ocupa a linha sozinho: agrupe em `SimpleGrid`, com mais colunas em
  telas largas (`cols={{ base: 1, sm: 3, lg: 4 }}`)

## Padrão de uma página típica

```jsx
import PageHeader from "../../components/ui/PageHeader";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";

export default function MinhaPagina() {
  const { data, loading } = useFetch("/rota");
  if (loading) return <Loading />;
  const itens = data || [];
  return (
    <>
      <PageHeader eyebrow="Seção" title="Título" subtitle="Descrição curta." />
      {itens.length === 0 ? (
        <EmptyState title="Nada aqui" description="..." />
      ) : (
        /* conteúdo */
      )}
    </>
  );
}
```

## Antes de finalizar

- `npm run build` (frontend) deve passar limpo.
- `npx eslint src` deve passar sem erros.
- Para validar visualmente, abrir no navegador (Vite em :5173, API em :3000).
