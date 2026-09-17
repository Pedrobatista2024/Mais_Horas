import { Group, Paper, Text, ThemeIcon } from "@mantine/core";

/** Um passo numerado da jornada (T1 e T2). */
export default function Passo({ icone: Icone, numero, titulo, children, cor = "brand" }) {
  return (
    <Paper withBorder radius="lg" p="lg" h="100%">
      <Group justify="space-between" mb="sm">
        <ThemeIcon size={48} radius="md" variant="light" color={cor}>
          <Icone size={26} />
        </ThemeIcon>
        <Text fw={900} fz={28} c="ink.2" aria-hidden>{numero}</Text>
      </Group>
      <Text fw={800} fz="lg" mb={4}>{titulo}</Text>
      <Text c="dimmed" size="sm">{children}</Text>
    </Paper>
  );
}
