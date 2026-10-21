import { useId } from "react";
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
  claro = false,
}) {
  // Sobre fundo escuro (menu lateral): "Mais" branco e "Horas" azul-claro.
  const corMais = claro ? "white" : "ink.8";
  const corHoras = claro ? "#a9bbff" : "brand.7";
  const fz = compact ? 21 : 26;
  // Cada relógio precisa do próprio id de gradiente: com dois logotipos na
  // tela (topo do celular e menu), o primeiro escondido apagava o aro do outro.
  const idDoRelogio = useId().replace(/[^a-zA-Z0-9]/g, "");

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
        fw={700}
        fz={fz}
        c={corMais}
        style={{ display: "inline-flex", alignItems: "center", letterSpacing: "-0.01em", lineHeight: 1 }}
      >
        Mais
        <Text span inherit c={corHoras}>
          H
        </Text>
        <ClockGlyph size={fz * 0.96} idSuffix={idDoRelogio} style={{ margin: "0 0.5px" }} />
        <Text span inherit c={corHoras}>
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
