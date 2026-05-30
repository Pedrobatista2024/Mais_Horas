import { Button, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";

export default function ActionCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onClick,
  color = "brand",
}) {
  return (
    <Paper withBorder radius="md" p="lg" className="mh-card-hover">
      <Stack gap="md" h="100%">
        <Group align="flex-start" wrap="nowrap">
          {Icon && (
            <ThemeIcon color={color} variant="light" size={44} radius="md" style={{ flexShrink: 0 }}>
              <Icon size={24} />
            </ThemeIcon>
          )}
          <div style={{ minWidth: 0 }}>
            <Text fw={800}>{title}</Text>
            <Text c="dimmed" size="sm" mt={2}>
              {description}
            </Text>
          </div>
        </Group>

        {actionLabel && (
          <Button variant="light" color={color} onClick={onClick} mt="auto">
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
