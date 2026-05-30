import { Button, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconInbox } from "@tabler/icons-react";

export default function EmptyState({
  icon: Icon = IconInbox,
  title = "Nada por aqui ainda",
  description,
  action,
}) {
  return (
    <Paper withBorder p={{ base: "lg", sm: "xl" }} radius="md">
      <Stack align="center" gap="sm" py={{ base: "md", sm: "lg" }}>
        <ThemeIcon variant="light" color="brand" size={58} radius="md">
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
