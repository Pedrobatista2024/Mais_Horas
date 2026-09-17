import { Box, Container, Stack, Text, Title } from "@mantine/core";

/**
 * Faixa de conteúdo do portal, com o cabeçalho centralizado.
 * `alternada` pinta o fundo, para separar seções vizinhas.
 */
export default function Secao({ eyebrow, titulo, subtitulo, alternada = false, children }) {
  return (
    <Box className={alternada ? "mh-section-alt" : undefined}>
      <Container size="xl" py={{ base: 48, md: 72 }}>
        {(eyebrow || titulo) && (
          <Stack align="center" gap={6} mb="xl">
            {eyebrow && (
              <Text tt="uppercase" fw={800} c="brand.7" size="sm">{eyebrow}</Text>
            )}
            {titulo && <Title order={2} ta="center">{titulo}</Title>}
            {subtitulo && (
              <Text c="dimmed" ta="center" maw={620}>{subtitulo}</Text>
            )}
          </Stack>
        )}
        {children}
      </Container>
    </Box>
  );
}
