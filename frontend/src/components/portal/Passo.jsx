import { Group, Paper, Text, ThemeIcon } from "@mantine/core";

/** Um passo numerado da jornada (T1 e T2). */
export default function Passo({ icone: Icone, numero, titulo, children, cor = "brand" }) {
  return (
    <Paper withBorder p="lg" h="100%">
      <Group justify="space-between" mb="sm">
        <ThemeIcon size={38} radius="md" variant="light" color={cor}>
          <Icone size={20} />
        </ThemeIcon>
        <Text fw={600} fz={20} c="dimmed" aria-hidden>{numero}</Text>
      </Group>
      <Text fw={600} mb={4}>{titulo}</Text>
      <Text c="dimmed" size="sm">{children}</Text>
    </Paper>
  );
}
