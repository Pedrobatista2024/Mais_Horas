import { Badge, Group, Stack, Text, Title } from "@mantine/core";

/**
 * Cabeçalho de página: título, uma linha de contexto e a ação principal.
 *
 * `eyebrow` vira texto miúdo e discreto, não etiqueta em caixa alta: uma
 * etiqueta colorida acima de cada título rouba a atenção do conteúdo e faz
 * todas as telas parecerem a mesma.
 */
export default function PageHeader({ title, subtitle, action, eyebrow, badge }) {
  return (
    <Group justify="space-between" align="flex-end" mb="lg" gap="md" wrap="wrap">
      <Stack gap={2} style={{ flex: 1, minWidth: 260 }}>
        {eyebrow && (
          <Text size="xs" c="dimmed">
            {eyebrow}
          </Text>
        )}
        <Group gap="sm" align="center" wrap="wrap">
          <Title order={1}>{title}</Title>
          {badge && (
            <Badge color={badge.color || "gray"} variant="light">
              {badge.label}
            </Badge>
          )}
        </Group>
        {subtitle && (
          <Text c="dimmed" size="sm" maw={720}>
            {subtitle}
          </Text>
        )}
      </Stack>
      {action}
    </Group>
  );
}
