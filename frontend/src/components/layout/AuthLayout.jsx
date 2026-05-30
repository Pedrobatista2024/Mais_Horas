import { Box, Center, Paper, Text, Title } from "@mantine/core";

/**
 * Layout das telas de login/cadastro: card centralizado com a marca.
 */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <Box mih="100vh" bg="#f4f6fb">
      <Center mih="100vh" p="md">
        <div style={{ width: "100%", maxWidth: 420 }}>
          <Title order={1} ta="center" mb={2}>
            Mais
            <Text span c="brand.6" inherit>
              Horas
            </Text>
          </Title>
          <Text c="dimmed" ta="center" mb="lg" size="sm">
            Conectando estudantes e ONGs por horas que transformam.
          </Text>
          <Paper withBorder shadow="sm" radius="lg" p="xl">
            {title && (
              <Title order={3} mb={subtitle ? 2 : "md"}>
                {title}
              </Title>
            )}
            {subtitle && (
              <Text c="dimmed" size="sm" mb="md">
                {subtitle}
              </Text>
            )}
            {children}
          </Paper>
        </div>
      </Center>
    </Box>
  );
}
