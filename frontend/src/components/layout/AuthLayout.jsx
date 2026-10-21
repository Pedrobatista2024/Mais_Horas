import { Link } from "react-router-dom";
import { Anchor, Box, Group, Stack, Text, Title } from "@mantine/core";

import { useTitulo } from "../../hooks/useTitulo";
import ExemplarCertificado from "../portal/ExemplarCertificado";
import BrandMark from "../ui/BrandMark";

/**
 * Telas de acesso: entrar, criar conta, recuperar senha.
 *
 * No computador a tela se divide: à esquerda o formulário, à direita uma foto
 * de voluntariado sob o véu azul-noite do portal, com o que a pessoa vai
 * ganhar com a conta (o certificado) por cima. No celular só o formulário,
 * sem cartão em volta: o campo de texto já é a moldura.
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
            <Title order={1} className="mh-serif" fz={{ base: 28, sm: 34 }} mb={subtitle ? 8 : "lg"}>
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
        <img src="/portal/reforco.jpg" alt="" className="mh-acesso-foto" />
        <Stack gap="xl" maw={440} className="mh-acesso-conteudo">
          <Box className="mh-acesso-certificado">
            <ExemplarCertificado />
          </Box>
          <Text c="white" ta="center" fz={22} lh={1.3} className="mh-serif">
            O certificado sai assim que a ONG confirma sua presença, e qualquer
            coordenação confere pelo QR Code.
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
