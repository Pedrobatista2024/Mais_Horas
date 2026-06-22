import { Group, Paper, Text, ThemeIcon } from "@mantine/core";

export default function StatCard({ icon: Icon, label, value, color = "brand", helper }) {
  return (
    <Paper withBorder p="lg" radius="lg" className="mh-card-hover">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {label}
          </Text>
          <Text fz={34} fw={900} lh={1.1} mt={6} c={`${color}.7`}>
            {value}
          </Text>
          {helper && (
            <Text size="xs" c="dimmed" mt={6}>
              {helper}
            </Text>
          )}
        </div>
        <ThemeIcon color={color} variant="light" size={52} radius="md">
          <Icon size={28} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
