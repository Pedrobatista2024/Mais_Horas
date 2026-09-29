import { createTheme } from "@mantine/core";

/**
 * Tema da marca "Mais Horas".
 *
 * A área logada é ferramenta de trabalho: tipografia em poucos tamanhos, raio
 * discreto, sombra nenhuma e cor reservada para ação e estado. Título gigante
 * e botão em formato de pílula competem com o conteúdo e envelhecem rápido.
 */
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 7,
  defaultRadius: "sm",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontFamily: "Inter, 'Segoe UI', sans-serif",
    fontWeight: "650",
    sizes: {
      h1: { fontSize: "1.75rem", lineHeight: "1.2" },
      h2: { fontSize: "1.375rem", lineHeight: "1.25" },
      h3: { fontSize: "1.0625rem", lineHeight: "1.3" },
      h4: { fontSize: "0.9375rem", lineHeight: "1.35" },
    },
  },
  components: {
    Button: { defaultProps: { radius: "sm" } },
    // Sem caixa alta: "FINALIZADA" ao lado do título grita mais que o título.
    Badge: { defaultProps: { radius: "sm", tt: "none", fw: 600 } },
    Card: { defaultProps: { radius: "md", shadow: "none" } },
    Paper: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { radius: "md" } },
  },
  colors: {
    // Azul royal saturado (primária)
    brand: [
      "#e8edfb",
      "#cdd8f6",
      "#a3b6ef",
      "#7390e7",
      "#4a6ee0",
      "#2f57d8",
      "#1f47c9", // 6
      "#1839b0", // 7 - principal (royal)
      "#142f8f",
      "#0f2570",
    ],
    // Azul profundo (fundos escuros / hero)
    navy: [
      "#e7ebf6",
      "#c4cde9",
      "#9badd9",
      "#7089c9",
      "#4d6bbc",
      "#3656b3",
      "#2b49a0",
      "#21397e",
      "#172a5e",
      "#0d1b40",
    ],
    // Âmbar/dourado (CTA de destaque, como o "Inscreva-se" laranja da Unifor)
    clay: [
      "#fff4e0",
      "#ffe5b8",
      "#ffd384",
      "#ffc14f",
      "#ffb226",
      "#fba70f",
      "#ef9504",
      "#c77703",
      "#9e5d05",
      "#744304",
    ],
    // Cinza-azulado (textos/neutros)
    ink: [
      "#f4f6fa",
      "#e6eaf1",
      "#cbd3e0",
      "#aab8cd",
      "#8b9bb6",
      "#64748f",
      "#4a5a75",
      "#36465f",
      "#212e45",
      "#111c30",
    ],
  },
});
