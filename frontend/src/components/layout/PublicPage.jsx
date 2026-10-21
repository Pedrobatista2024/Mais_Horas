import { Link } from "react-router-dom";
import { Anchor, Box, Container, Group } from "@mantine/core";

import BrandMark from "../ui/BrandMark";

/**
 * Página pública solta, fora do portal: hoje, a verificação de certificado.
 * Topo mínimo, para quem chega pelo QR ir direto ao veredito.
 */
export default function PublicPage({ children, largura = 760 }) {
  return (
    <Box className="mh-public-page">
      <Box className="mh-topbar">
        <Container size={largura}>
          <Group h={60} justify="space-between">
            <Link to="/" aria-label="Mais Horas, página inicial"
                  style={{ textDecoration: "none" }}>
              <BrandMark compact />
            </Link>
            <Anchor component={Link} to="/" size="sm" c="dimmed">O que é a Mais Horas</Anchor>
          </Group>
        </Container>
      </Box>

      <Container size={largura} w="100%" py={{ base: 28, md: 48 }} component="main">
        {children}
      </Container>
    </Box>
  );
}
