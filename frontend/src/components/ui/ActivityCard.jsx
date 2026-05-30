import { Card, Group, Stack, Text, Title, SimpleGrid } from "@mantine/core";
import {
  IconCalendar,
  IconClock,
  IconMapPin,
  IconHourglass,
  IconUsers,
} from "@tabler/icons-react";
import StatusBadge from "./StatusBadge";
import { formatDate } from "../../utils/format";

function Info({ icon: Icon, label, value }) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Icon size={16} style={{ marginTop: 2, opacity: 0.6, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={600} truncate>
          {value}
        </Text>
      </div>
    </Group>
  );
}

export default function ActivityCard({ activity, orgSlot, footer, onClick }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      style={{ cursor: onClick ? "pointer" : "default", height: "100%" }}
      onClick={onClick}
    >
      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Title order={4} lineClamp={1}>
              {activity.title}
            </Title>
            {orgSlot}
          </div>
          <StatusBadge status={activity.status} />
        </Group>

        <SimpleGrid cols={2} spacing="xs">
          <Info icon={IconCalendar} label="Data" value={formatDate(activity.date)} />
          <Info
            icon={IconClock}
            label="Horário"
            value={`${activity.startTime || "-"} – ${activity.endTime || "-"}`}
          />
          <Info icon={IconMapPin} label="Local" value={activity.location || "-"} />
          <Info
            icon={IconHourglass}
            label="Carga horária"
            value={`${activity.workloadHours ?? "-"}h`}
          />
          <Info
            icon={IconUsers}
            label="Vagas"
            value={`mín ${activity.minParticipants ?? "-"} / máx ${activity.maxParticipants ?? "-"}`}
          />
        </SimpleGrid>

        {activity.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {activity.description}
          </Text>
        )}

        {footer && <div style={{ marginTop: "auto" }}>{footer}</div>}
      </Stack>
    </Card>
  );
}
