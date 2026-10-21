import { Box, Container, Text, Title } from "@mantine/core";

import { LARGURA_DO_PORTAL } from "./navegacao";

/**
 * Faixa de conteúdo do portal. O título fica alinhado à esquerda, junto do
 * texto que ele apresenta: título centralizado em cima de cada seção, com uma
 * etiqueta colorida acima, é o que fazia o portal parecer modelo pronto.
 *
 * `nevoa` pinta o fundo de cinza claro, para separar seções vizinhas.
 */
export default function Secao({ titulo, subtitulo, nevoa = false, acao, children }) {
  return (
    <Box component="section" className={`mh-secao${nevoa ? " mh-secao-nevoa" : ""}`}>
      <Container size={LARGURA_DO_PORTAL}>
        {titulo && (
          <Box mb={{ base: 28, md: 40 }} maw={680}>
            <Title order={2} fz={{ base: 26, md: 32 }} lh={1.15}>{titulo}</Title>
            {subtitulo && <Text c="dimmed" fz="lg" mt="sm">{subtitulo}</Text>}
          </Box>
        )}
        {children}
        {acao && <Box mt={{ base: 28, md: 40 }}>{acao}</Box>}
      </Container>
    </Box>
  );
}
