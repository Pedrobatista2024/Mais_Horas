import { Container } from "@mantine/core";

import { LARGURA_DO_PORTAL } from "./navegacao";

/** Moldura das páginas do portal que não são faixas (vagas, detalhe da vaga). */
export default function ConteudoDoPortal({ children }) {
  return (
    <Container size={LARGURA_DO_PORTAL} py={{ base: 28, md: 48 }}>
      {children}
    </Container>
  );
}
