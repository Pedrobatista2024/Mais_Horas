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
2. **Reaproveite os componentes existentes** em `src/components/ui` antes de criar novos:
   - `PageHeader` — cabeçalho de página (props: `eyebrow`, `title`, `subtitle`, `action`)
   - `StatCard` — cartão de métrica (`icon`, `label`, `value`, `color`)
   - `ActivityCard` — cartão de atividade (`activity`, `orgSlot`, `footer`, `onClick`)
   - `ActionCard` — cartão de ação com CTA
   - `InfoItem` — par rótulo/valor com ícone (`icon`, `label`, `value`, `href`, `color`)
   - `StatusBadge` — badge de status (`pending|present|absent|active|finished|cancelled`)
   - `EmptyState` — estado vazio (`icon`, `title`, `description`, `action`)
   - `Loading` — spinner centralizado
   - `BackButton` — botão voltar
   - `BrandMark` — logo "MaisHoras"
3. **Layouts:** `AppLayout` (área logada, AppShell + navbar), `AuthLayout` (login/registro),
   `PublicPage` (verificação de certificado e perfis públicos).
4. **Dados:** use o hook `useFetch(url)` para GET (`{ data, loading, error, refetch, setData }`).
   Mutations via `api` de `src/services/api`. Sempre trate `loading` com `<Loading />` e
   listas vazias com `<EmptyState />`.
5. **Feedback:** use `notifySuccess` / `notifyError` de `src/utils/notify` (toasts Mantine).
   Nunca `alert()`. Erros de API: `notifyError(err, "mensagem fallback")`.
6. **Datas:** `formatDate(iso)` de `src/utils/format`. Imagens: `resolveImage(photo, photoUrl)`.
   Iniciais de avatar: `initials(nome)`.

## Paleta (tema em src/theme.js)

- `brand` (verde, primária, shade 6 `#27ae60`) — ações principais, identidade
- `navy` (azul, shade 6 `#2e5aac`) — área/itens da ONG
- `clay` (terracota) — destaques secundários (ex.: badge de carga horária)
- `ink` (cinza-esverdeado) — textos/neutros
- Texto secundário: `c="dimmed"`. Títulos de seção: `fw={800}` ou eyebrow `tt="uppercase" c="brand.7"`.

## Classes CSS utilitárias (src/index.css)

- `.mh-page-band` — superfície de conteúdo (cartão grande de página)
- `.mh-card-hover` — hover elevado em cartões clicáveis
- `.mh-topbar`, `.mh-sidebar`, `.mh-main`, `.mh-app-shell` — chrome do AppShell
- `.mh-auth-page`, `.mh-public-page` — fundo das páginas públicas
- `.mh-nav-button[data-active]` — item de navegação

## Responsividade (obrigatório)

A maioria dos estudantes acessa por celular. Sempre:
- `SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}` em vez de colunas fixas
- Padding responsivo: `p={{ base: "lg", sm: "xl" }}`
- `Group` com `wrap="wrap"` quando houver risco de estouro
- Testar em 375px de largura

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
