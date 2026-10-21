import { Box, Container, Text, Title } from "@mantine/core";

import { LARGURA_DO_PORTAL } from "./navegacao";

const FUNDOS = { branco: "", azul: " mh-secao-azul", noite: " mh-secao-noite" };

/**
 * Faixa de conteúdo do portal. O título fica à esquerda, em Fraunces, junto
 * do texto que ele apresenta. `fundo` alterna as seções entre branco,
 * azul-claro e azul-noite — é a alternância que dá ritmo à página.
 *
 * `nevoa` continua aceito e vale como `fundo="azul"`.
 */
export default function Secao({
  titulo, subtitulo, fundo, nevoa = false, acao, children, centro = false,
}) {
  const cor = fundo ?? (nevoa ? "azul" : "branco");
  const noite = cor === "noite";
  return (
    <Box component="section" className={`mh-secao${FUNDOS[cor] ?? ""}`}>
      <Container size={LARGURA_DO_PORTAL}>
        {titulo && (
          <Box mb={{ base: 28, md: 44 }} maw={centro ? 760 : 680} mx={centro ? "auto" : undefined}
               ta={centro ? "center" : undefined}>
            <Title order={2} className="mh-serif" fz={{ base: 30, md: 42 }}
                   c={noite ? "white" : undefined}>
              {titulo}
            </Title>
            {subtitulo && (
              <Text fz="lg" mt="sm" c={noite ? "rgba(255,255,255,0.78)" : "dimmed"}>
                {subtitulo}
              </Text>
            )}
          </Box>
        )}
        {children}
        {acao && <Box mt={{ base: 28, md: 40 }}>{acao}</Box>}
      </Container>
    </Box>
  );
}
