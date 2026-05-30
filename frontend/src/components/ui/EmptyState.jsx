import { Button, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconInbox } from "@tabler/icons-react";

export default function EmptyState({
  icon: Icon = IconInbox,
  title = "Nada por aqui ainda",
  description,
  action,
}) {
  return (
    <Paper withBorder p="xl" radius="md">
      <Stack align="center" gap="sm" py="lg">
        <ThemeIcon variant="light" color="gray" size={56} radius="xl">
          <Icon size={30} />
        </ThemeIcon>
        <Text fw={700} size="lg">
          {title}
        </Text>
        {description && (
          <Text c="dimmed" size="sm" ta="center" maw={420}>
            {description}
          </Text>
        )}
        {action && (
          <Button mt="xs" onClick={action.onClick} leftSection={action.icon}>
            {action.label}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
