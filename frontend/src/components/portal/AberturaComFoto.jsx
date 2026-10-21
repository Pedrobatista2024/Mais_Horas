import { Box, Container, Grid } from "@mantine/core";

import { LARGURA_DO_PORTAL } from "./navegacao";

/**
 * Abertura de página do portal: foto de gente ocupando a largura toda, um véu
 * azul por cima do lado do texto e, opcionalmente, um cartão branco flutuando
 * à direita (`lado`).
 *
 * `fotoMenor` (1200px) entra no `srcSet` para o celular não baixar a de 2400.
 * `baixa` encurta a altura, para páginas internas.
 */
export default function AberturaComFoto({
  foto, fotoMenor, alt, posicao, baixa = false, lado, children,
}) {
  return (
    <Box component="section" className="mh-abertura" data-baixa={baixa || undefined}>
      <img className="mh-abertura-foto" src={foto} alt={alt} width={2400} height={1350}
           srcSet={fotoMenor ? `${fotoMenor} 1200w, ${foto} 2400w` : undefined}
           sizes="100vw" fetchPriority="high"
           style={posicao ? { objectPosition: posicao } : undefined} />
      <div className="mh-abertura-veu" aria-hidden="true" />
      <Container size={LARGURA_DO_PORTAL} className="mh-abertura-conteudo">
        <Grid w="100%" gutter={{ base: 32, md: 64 }} align="center">
          <Grid.Col span={{ base: 12, md: lado ? 7 : 9 }}>{children}</Grid.Col>
          {lado && <Grid.Col span={{ base: 12, md: 5 }}>{lado}</Grid.Col>}
        </Grid>
      </Container>
    </Box>
  );
}
