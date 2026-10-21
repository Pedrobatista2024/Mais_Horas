import { createTheme } from "@mantine/core";

/**
 * Cor do texto dos selos e alertas "light" e do fundo dos "filled" vermelhos.
 *
 * O padrão do Mantine põe o texto do selo claro na tonalidade 6: "Acontecendo
 * agora" em verde dava 2,5:1 sobre o próprio fundo, e "Cancelada" 3,4:1 —
 * abaixo dos 4,5:1 que o texto pequeno exige (WCAG AA). Estas cores foram
 * medidas no navegador sobre o fundo real do selo.
 */
const TEXTO_DO_SELO = {
  green: "#1d6b2f",
  teal: "#0b6b52",
  red: "#b02525",
  orange: "#b03f0a",
  yellow: "#7a5000",
  violet: "#5b2db0",
  grape: "#7a2a8f",
  gray: "#4a5a75",
};

export function variaveisDoTema() {
  const light = {};
  for (const [cor, hex] of Object.entries(TEXTO_DO_SELO)) {
    light[`--mantine-color-${cor}-light-color`] = hex;
  }
  // Selo e alerta "filled" em vermelho: branco sobre o vermelho padrão dava 3,8:1.
  light["--mantine-color-red-filled"] = "#c92a2a";
  light["--mantine-color-red-filled-hover"] = "#b02525";
  return { variables: {}, light, dark: {} };
}

/**
 * Tema da marca "Mais Horas".
 *
 * Três regras guiam o resto:
 *
 * - Azul royal é ação e marca. Âmbar é **hora**, e só hora: a carga horária de
 *   uma vaga, o total de um certificado, a soma na caderneta. Se aparecer âmbar
 *   em outro lugar, a cor deixa de dizer alguma coisa.
 * - IBM Plex Sans é a voz do sistema, a mesma da apresentação e do PDF do
 *   certificado. Plex Mono só para o que é código de verdade (certificado,
 *   check-in) — nunca como enfeite de rótulo.
 * - Os cinzas são azulados e escuros o bastante para passar no contraste AA:
 *   o `dimmed` do Mantine (gray.6) dava 3,3:1 sobre branco; este dá 5,5:1.
 */
export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 7,
  black: "#1b2540",
  white: "#ffffff",
  defaultRadius: "sm",
  fontFamily:
    "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace:
    "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSizes: {
    xs: "0.8125rem", // 13
    sm: "0.875rem", // 14
    md: "0.9375rem", // 15
    lg: "1.0625rem", // 17
    xl: "1.25rem", // 20
  },
  lineHeights: { xs: "1.45", sm: "1.5", md: "1.55", lg: "1.5", xl: "1.4" },
  radius: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px" },
  spacing: { xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },
  headings: {
    fontFamily:
      "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontWeight: "600",
    textWrap: "balance",
    sizes: {
      h1: { fontSize: "1.75rem", lineHeight: "1.2" }, // 28
      h2: { fontSize: "1.3125rem", lineHeight: "1.3" }, // 21
      h3: { fontSize: "1.0625rem", lineHeight: "1.35" }, // 17
      h4: { fontSize: "0.9375rem", lineHeight: "1.4" }, // 15
    },
  },
  components: {
    Button: { defaultProps: { radius: "sm" } },
    // Sem caixa alta: "FINALIZADA" ao lado do título grita mais que o título.
    Badge: {
      defaultProps: { radius: "xs", tt: "none", fw: 600, variant: "light" },
    },
    Card: { defaultProps: { radius: "md", shadow: "none" } },
    Paper: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { radius: "md", centered: true } },
    Anchor: { defaultProps: { underline: "hover" } },
    Tooltip: { defaultProps: { withArrow: true } },
    Loader: { defaultProps: { type: "dots" } },
    Table: {
      defaultProps: {
        verticalSpacing: "sm", horizontalSpacing: "md", highlightOnHover: true,
      },
    },
  },
  colors: {
    // Azul royal (primária). 7 é a cor da marca.
    brand: [
      "#eaeefb", "#d3dcf6", "#a9baed", "#7c95e3", "#5476da",
      "#3a60d3", "#2a4fc6", "#1839b0", "#142f8f", "#0f2570",
    ],
    // Azul noite: fundo do portal e do rodapé.
    navy: [
      "#e7ebf6", "#c4cde9", "#9badd9", "#7089c9", "#4d6bbc",
      "#3656b3", "#2b49a0", "#21397e", "#172a5e", "#0d1b40",
    ],
    // Âmbar: carga horária. 6 é o âmbar do relógio do logotipo; texto em
    // âmbar usa 8, que passa no contraste.
    clay: [
      "#fff6e5", "#ffe9c2", "#ffd68a", "#ffc24f", "#fbb024",
      "#f5a00d", "#ef9504", "#c77703", "#9a5c04", "#6e4103",
    ],
    // Cinza azulado, no lugar do cinza neutro do Mantine. gray.6 é o `dimmed`.
    gray: [
      "#f6f7fa", "#eef1f5", "#e3e7ef", "#cfd6e2", "#b2bccc",
      "#8a96ab", "#5c6882", "#4a5a75", "#36435c", "#1b2540",
    ],
    ink: [
      "#f6f7fa", "#eef1f5", "#e3e7ef", "#cfd6e2", "#b2bccc",
      "#8a96ab", "#5c6882", "#4a5a75", "#36435c", "#1b2540",
    ],
  },
});
