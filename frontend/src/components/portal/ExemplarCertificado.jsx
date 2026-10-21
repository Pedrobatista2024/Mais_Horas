import { useEffect, useState } from "react";
import { Box, Group, Stack, Text } from "@mantine/core";
import QRCode from "qrcode";

import ClockGlyph from "../ui/ClockGlyph";

/**
 * Um certificado de exemplo, desenhado com os mesmos elementos do PDF de
 * verdade: faixa da marca, nome, atividade, carga horária, código e QR.
 *
 * Está marcado como exemplo, e o QR leva à página de verificação, não a um
 * certificado inventado. É a peça que mostra, sem precisar explicar, o que o
 * projeto entrega de diferente.
 */
export default function ExemplarCertificado() {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/verificar`, {
      width: 168, margin: 0, color: { dark: "#1b2540", light: "#fffefb" },
    }).then(setQr).catch(() => setQr(null));
  }, []);

  return (
    <Box className="mh-exemplar" role="img"
         aria-label="Exemplo de certificado: nome, atividade, carga horária, código e QR Code">
      <Group justify="space-between" px="lg" py="sm" bg="var(--mh-royal)" c="white"
             style={{ borderRadius: "2px 2px 0 0", marginTop: -6 }}>
        <Group gap={6} wrap="nowrap">
          <Text fw={700} c="white" lh={1}>Mais</Text>
          <ClockGlyph size={18} idSuffix="exemplar" />
          <Text fw={700} c="white" lh={1} ml={-4}>Horas</Text>
        </Group>
        <Text size="xs" c="rgba(255,255,255,0.8)">Exemplo</Text>
      </Group>

      <Stack gap={4} p="lg" pb="md">
        <Text size="sm" c="dimmed">Certificamos que</Text>
        <Text fw={600} fz={22} lh={1.2}>Ana Beatriz Souza Lima</Text>
        <Text size="sm" mt={6} maw={360}>
          participou de <b>Plantio no Parque do Cocó</b>, realizado pelo Instituto Verde
          Mar em 7 de outubro de 2026, com carga horária de
        </Text>
        <Box mt={8}>
          <span className="mh-horas" style={{ fontSize: "1.25rem", padding: "2px 10px" }}>
            4 horas
          </span>
        </Box>
      </Stack>

      <Group justify="space-between" align="flex-end" px="lg" pb="lg" pt="sm" wrap="nowrap"
             style={{ borderTop: "1px dashed var(--mh-linha-forte)" }}>
        <Box>
          <Text size="xs" c="dimmed">Código de verificação</Text>
          <Text ff="monospace" fw={500} translate="no">2761 c894 7839 2c6b</Text>
          <Text size="xs" c="dimmed" mt={6}>Assinado digitalmente (Ed25519)</Text>
        </Box>
        {qr && <img src={qr} width={84} height={84} alt="" style={{ display: "block" }} />}
      </Group>
    </Box>
  );
}
