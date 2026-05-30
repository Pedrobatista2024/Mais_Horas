import { Group, Paper, Text, ThemeIcon } from "@mantine/core";

export default function StatCard({ icon: Icon, label, value, color = "brand" }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {label}
          </Text>
          <Text fz={28} fw={800} lh={1.1} mt={4}>
            {value}
          </Text>
        </div>
        {Icon && (
          <ThemeIcon color={color} variant="light" size={48} radius="md">
            <Icon size={26} />
          </ThemeIcon>
        )}
      </Group>
    </Paper>
  );
}
