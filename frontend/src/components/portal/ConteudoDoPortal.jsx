import { Container } from "@mantine/core";

/** Moldura das páginas do portal que não são faixas (vagas, detalhe). */
export default function ConteudoDoPortal({ children, tamanho = "xl" }) {
  return (
    <Container size={tamanho} py={{ base: "lg", md: 40 }}>
      {children}
    </Container>
  );
}
