import { createTheme } from "@mantine/core";

/**
 * Tema da marca "Mais Horas".
 * Azul royal institucional (inspiração: universidades), botões em formato
 * "pill", tipografia display forte para títulos.
 */
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 7,
  defaultRadius: "md",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontFamily: "Inter, 'Segoe UI', sans-serif",
    fontWeight: "800",
    sizes: {
      h1: { fontSize: "2.6rem", lineHeight: "1.1" },
      h2: { fontSize: "2rem", lineHeight: "1.15" },
    },
  },
  defaultGradient: { from: "brand.8", to: "brand.6", deg: 135 },
  components: {
    Button: {
      defaultProps: { radius: "xl" },
    },
    Badge: {
      defaultProps: { radius: "sm" },
    },
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
