import { Box, Group, Text, UnstyledButton } from "@mantine/core";

import { formatRelativo } from "../../utils/format";

/**
 * Uma linha de aviso. O não lido ganha um ponto azul à esquerda e título em
 * negrito; o fundo fica branco nos dois casos, para a lista não virar uma
 * colcha de faixas azuis.
 */
export default function ItemDeAviso({ aviso, aoAbrir, emLista = false }) {
  return (
    <UnstyledButton onClick={() => aoAbrir(aviso)} w="100%"
                    className={emLista ? "mh-linha" : undefined}
                    data-clicavel={emLista || undefined}
                    p={emLista ? undefined : "xs"}
                    style={emLista ? undefined : { borderRadius: 6 }}
                    aria-label={aviso.lida ? undefined : `Não lido: ${aviso.titulo}`}>
      <Group align="flex-start" wrap="nowrap" gap="sm">
        <Box w={8} h={8} mt={7} style={{
          flexShrink: 0, borderRadius: 4,
          background: aviso.lida ? "transparent" : "var(--mh-royal)",
        }} />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" align="baseline" wrap="nowrap" gap="xs">
            <Text size="sm" fw={aviso.lida ? 500 : 600} lineClamp={1}>
              {aviso.titulo}
            </Text>
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {formatRelativo(aviso.criadoEm)}
            </Text>
          </Group>
          <Text size="sm" c="dimmed" lineClamp={2}>
            {aviso.mensagem}
          </Text>
        </Box>
      </Group>
    </UnstyledButton>
  );
}
