import { Box, Group, Title } from "@mantine/core";

import { useTitulo } from "../../hooks/useTitulo";

/**
 * Capa azul-noite do painel (E1 e O1): o mesmo azul do portal, trazido para
 * dentro, só na primeira tela de cada um.
 *
 * À esquerda quem é e a situação em uma linha (`children`); à direita o que
 * se acompanha (`lateral`): as horas do aluno, os números da ONG. A faixa do
 * destaque, quando há, entra no pé (`rodape`).
 */
export default function CapaDoPainel({ titulo, children, lateral, acao, rodape }) {
  useTitulo("Painel");

  return (
    <Box component="header" className="mh-capa" mb={{ base: 28, sm: 36 }}>
      <Group justify="space-between" align="flex-end" gap="xl" wrap="wrap"
             className="mh-capa-corpo">
        <Box style={{ flex: "1 1 300px", minWidth: 0 }}>
          <Title order={1} className="mh-serif" c="white" fz={{ base: 30, sm: 40 }}>
            {titulo}
          </Title>
          {children}
          {acao && <Box mt="lg">{acao}</Box>}
        </Box>
        {lateral}
      </Group>
      {rodape}
    </Box>
  );
}
