import { Group, Paper, Text } from "@mantine/core";

/**
 * Indicador numérico.
 *
 * Sem quadrado colorido com ícone e sem rótulo em caixa alta: o número é o
 * conteúdo, e enfeite em volta de cada um deles faz o painel inteiro parecer
 * um catálogo de cartões iguais. O ícone fica pequeno e apagado, só para dar
 * um ponto de reconhecimento.
 */
export default function StatCard({ icon: Icon, label, value, color, helper }) {
  return (
    <Paper withBorder p="md">
      <Group gap={6} wrap="nowrap" mb={6}>
        {Icon && <Icon size={15} color="var(--mantine-color-dimmed)" />}
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Group>
      <Text fz={30} fw={600} lh={1.1} c={color ? `${color}.7` : undefined}>
        {value}
      </Text>
      {helper && (
        <Text size="xs" c="dimmed" mt={4}>
          {helper}
        </Text>
      )}
    </Paper>
  );
}
