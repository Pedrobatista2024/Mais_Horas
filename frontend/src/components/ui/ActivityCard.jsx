import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconClock, IconMapPin, IconUsers } from "@tabler/icons-react";

import { formatDate } from "../../utils/format";
import StatusBadge from "./StatusBadge";

function Info({ icon: Icon, label, value }) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <Icon size={16} style={{ marginTop: 2, opacity: 0.62, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={650} truncate>
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
      className={onClick ? "mh-card-hover" : undefined}
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
          <Stack gap={6} align="flex-end">
            <StatusBadge status={activity.status} />
            <Badge color="clay" variant="light" radius="sm">
              {activity.workloadHours ?? "-"}h
            </Badge>
          </Stack>
        </Group>

        <SimpleGrid cols={2} spacing="xs">
          <Info icon={IconCalendar} label="Data" value={formatDate(activity.date)} />
          <Info
            icon={IconClock}
            label="Horário"
            value={`${activity.startTime || "-"} - ${activity.endTime || "-"}`}
          />
          <Info icon={IconMapPin} label="Local" value={activity.location || "-"} />
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
