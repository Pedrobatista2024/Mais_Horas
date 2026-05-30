import { Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";

export default function StatCard({ icon: Icon, label, value, color = "brand", helper }) {
  return (
    <Paper withBorder p="lg" radius="md" className="mh-card-hover">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {label}
          </Text>
          <Text fz={30} fw={900} lh={1.05} c="ink.9">
            {value}
          </Text>
          {helper && (
            <Text size="xs" c="dimmed">
              {helper}
            </Text>
          )}
        </Stack>
        {Icon && (
          <ThemeIcon color={color} variant="light" size={50} radius="md">
            <Icon size={26} />
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}
