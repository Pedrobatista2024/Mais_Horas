import { Group, Text, UnstyledButton } from "@mantine/core";

import { formatRelativo } from "../../utils/format";

/** Uma linha de aviso. Não lido fica destacado até ser aberto. */
export default function ItemDeAviso({ aviso, aoAbrir }) {
  return (
    <UnstyledButton onClick={() => aoAbrir(aviso)} w="100%" p="xs"
                    style={{ borderRadius: 8 }}
                    bg={aviso.lida ? undefined : "var(--mantine-color-brand-0)"}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
        <div style={{ minWidth: 0 }}>
          <Text size="sm" fw={aviso.lida ? 500 : 700}>
            {aviso.titulo}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {aviso.mensagem}
          </Text>
        </div>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {formatRelativo(aviso.criadoEm)}
        </Text>
      </Group>
    </UnstyledButton>
  );
}
