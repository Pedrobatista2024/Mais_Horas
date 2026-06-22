import { Stack, Text } from "@mantine/core";
import ClockGlyph from "./ClockGlyph";

/**
 * Logotipo "MaisHoras" — o "o" de Horas é um relógio (ClockGlyph).
 * "Mais" em tom escuro, "H_ras" em azul da marca.
 */
export default function BrandMark({
  onClick,
  compact = false,
  showTagline = false,
  align = "flex-start",
}) {
  const fz = compact ? 21 : 26;

  return (
    <Stack
      gap={0}
      align={align}
      className="mh-brand-mark"
      data-clickable={onClick ? "true" : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      style={{ minWidth: 0, lineHeight: 1 }}
    >
      <Text
        component="span"
        fw={900}
        fz={fz}
        c="ink.8"
        style={{ display: "inline-flex", alignItems: "center", letterSpacing: "-0.01em", lineHeight: 1 }}
      >
        Mais
        <Text span inherit c="brand.7">
          H
        </Text>
        <ClockGlyph size={fz * 0.96} style={{ margin: "0 0.5px" }} />
        <Text span inherit c="brand.7">
          ras
        </Text>
      </Text>
      {showTagline && (
        <Text size="xs" c="dimmed" lh={1.25} mt={2}>
          Horas que transformam
        </Text>
      )}
    </Stack>
  );
}
