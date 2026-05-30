import { Box, Center, Container, Group, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";

/**
 * Casca simples para páginas públicas (verificação de certificado, perfis públicos).
 */
export default function PublicPage({ children, maxWidth = "sm" }) {
  const navigate = useNavigate();
  return (
    <Box mih="100vh" bg="#f4f6fb">
      <Box bg="white" style={{ borderBottom: "1px solid #e9ecef" }}>
        <Container size="lg">
          <Group h={60} align="center">
            <Text
              fw={900}
              fz="xl"
              style={{ cursor: "pointer" }}
              onClick={() => navigate("/")}
            >
              Mais
              <Text span c="brand.6" inherit>
                Horas
              </Text>
            </Text>
          </Group>
        </Container>
      </Box>
      <Center p="md">
        <Container size={maxWidth} w="100%" py="xl">
          {children}
        </Container>
      </Center>
    </Box>
  );
}
