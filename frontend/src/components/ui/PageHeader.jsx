import { Badge, Group, Stack, Text, Title } from "@mantine/core";

export default function PageHeader({ title, subtitle, action, eyebrow, badge }) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" gap="md" wrap="wrap">
      <Stack gap={4} style={{ flex: 1, minWidth: 260 }}>
        {(eyebrow || badge) && (
          <Group gap="xs">
            {eyebrow && (
              <Text size="xs" fw={800} tt="uppercase" c="brand.7">
                {eyebrow}
              </Text>
            )}
            {badge && (
              <Badge color={badge.color || "brand"} variant="light" radius="sm">
                {badge.label}
              </Badge>
            )}
          </Group>
        )}
        <Title order={1} fz={{ base: 28, sm: 34 }} lh={1.08}>
          {title}
        </Title>
        {subtitle && (
          <Text c="dimmed" size="sm" maw={680}>
            {subtitle}
          </Text>
        )}
      </Stack>
      {action}
    </Group>
  );
}
