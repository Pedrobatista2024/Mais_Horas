import { Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconHeartHandshake } from "@tabler/icons-react";

export default function BrandMark({
  onClick,
  compact = false,
  showTagline = false,
  align = "flex-start",
}) {
  return (
    <Group
      gap={compact ? 8 : 10}
      wrap="nowrap"
      align="center"
      className="mh-brand-mark"
      data-clickable={onClick ? "true" : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
    >
      <ThemeIcon
        size={compact ? 38 : 46}
        radius={8}
        variant="filled"
        color="brand"
        className="mh-brand-symbol"
      >
        <IconHeartHandshake size={compact ? 21 : 25} stroke={1.8} />
      </ThemeIcon>

      <Stack gap={0} align={align} style={{ minWidth: 0 }}>
        <Text fw={900} fz={compact ? 20 : 24} lh={1} c="ink.8">
          Mais
          <Text span inherit c="brand.7">
            Horas
          </Text>
        </Text>
        {showTagline && (
          <Text size="xs" c="dimmed" lh={1.25}>
            Conexão entre estudantes e impacto social
          </Text>
        )}
      </Stack>
    </Group>
  );
}
