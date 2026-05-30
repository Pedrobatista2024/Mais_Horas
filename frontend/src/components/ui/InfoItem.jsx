import { Anchor, Group, Text, ThemeIcon } from "@mantine/core";

export default function InfoItem({ icon: Icon, label, value, href, color = "brand" }) {
  if (!value) return null;

  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      {Icon && (
        <ThemeIcon variant="light" color={color} size={36} radius="md" style={{ flexShrink: 0 }}>
          <Icon size={18} />
        </ThemeIcon>
      )}
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">
          {label}
        </Text>
        {href ? (
          <Anchor href={href} target="_blank" rel="noreferrer" size="sm" fw={650}>
            {value}
          </Anchor>
        ) : (
          <Text size="sm" fw={650} style={{ overflowWrap: "anywhere" }}>
            {value}
          </Text>
        )}
      </div>
    </Group>
  );
}
