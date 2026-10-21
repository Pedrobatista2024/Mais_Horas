import { Center, Loader, Stack, Text } from "@mantine/core";

export default function Loading({ label = "Carregando…" }) {
  return (
    <Center mih={200} role="status" aria-live="polite">
      <Stack align="center" gap="xs">
        <Loader color="brand" size="md" />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}
