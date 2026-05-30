import { Center, Loader, Stack, Text } from "@mantine/core";

export default function Loading({ label = "Carregando..." }) {
  return (
    <Center mih={240}>
      <Stack align="center" gap="xs">
        <Loader color="brand" />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}
