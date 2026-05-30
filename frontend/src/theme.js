import { createTheme } from "@mantine/core";

/**
 * Tema da marca "Mais Horas".
 * Paleta verde (comunidade / impacto social) como cor primária,
 * com um azul de apoio para a área das ONGs.
 */
export const theme = createTheme({
  primaryColor: "brand",
  defaultRadius: "md",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  headings: {
    fontWeight: "800",
  },
  colors: {
    brand: [
      "#e7f9ef",
      "#c8efd9",
      "#a3e4c0",
      "#7bd9a5",
      "#54cf8c",
      "#2fc575",
      "#27ae60", // 6 - principal
      "#1f8f4f",
      "#176b3b",
      "#0d4727",
    ],
    navy: [
      "#eaf0fb",
      "#cfdcf3",
      "#aec3ea",
      "#86a6e0",
      "#5f8ad6",
      "#3d72cc",
      "#2e5aac", // 6
      "#244784",
      "#1a345f",
      "#10213d",
    ],
  },
});

export default theme;
