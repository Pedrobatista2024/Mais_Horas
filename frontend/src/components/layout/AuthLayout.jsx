import { Link } from "react-router-dom";
import { Anchor, Box, Group, Stack, Text, Title } from "@mantine/core";

import { useTitulo } from "../../hooks/useTitulo";
import ExemplarCertificado from "../portal/ExemplarCertificado";
import BrandMark from "../ui/BrandMark";

/**
 * Telas de acesso: entrar, criar conta, recuperar senha.
 *
 * No computador a tela se divide: à esquerda o formulário, à direita o que a
 * pessoa vai ganhar com a conta, o certificado. No celular só o formulário,
 * sem cartão em volta — o campo de texto já é a moldura.
 */
export default function AuthLayout({ title, subtitle, children }) {
  useTitulo(typeof title === "string" ? title : undefined);

  return (
    <Box className="mh-acesso">
      <Box className="mh-acesso-form">
        <Group justify="space-between" mb={{ base: 32, md: 56 }}>
          <Link to="/" aria-label="Mais Horas, página inicial" style={{ textDecoration: "none" }}>
            <BrandMark compact />
          </Link>
          <Anchor component={Link} to="/verificar" size="sm" c="dimmed">
            Verificar certificado
          </Anchor>
        </Group>

        <Box w="100%" maw={400} mx="auto" component="main">
          {title && (
            <Title order={1} fz={{ base: 26, sm: 30 }} mb={subtitle ? 6 : "lg"}>
              {title}
            </Title>
          )}
          {subtitle && (
            <Text c="dimmed" mb="lg">
              {subtitle}
            </Text>
          )}
          {children}
        </Box>
      </Box>

      <Box className="mh-acesso-lado" visibleFrom="md">
        <Stack gap="lg" maw={420}>
          <ExemplarCertificado />
          <Text c="dimmed" ta="center" size="sm">
            O certificado sai assim que a ONG confirma sua presença, e qualquer
            coordenação confere pelo QR Code.
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
