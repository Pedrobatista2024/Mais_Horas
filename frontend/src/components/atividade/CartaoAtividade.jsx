import { Badge, Card, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import {
  IconCalendar, IconCheck, IconClock, IconMapPin, IconUsers,
} from "@tabler/icons-react";

import { formatDate } from "../../utils/format";
import SituacaoBadge from "./SituacaoBadge";

function Linha({ icon: Icon, children }) {
  return (
    <Group gap={7} wrap="nowrap" c="dimmed">
      <Icon size={15} style={{ flexShrink: 0, opacity: 0.75 }} />
      <Text size="sm" truncate>
        {children}
      </Text>
    </Group>
  );
}

/**
 * Cartão de atividade — usado na vitrine (E2) e em "minhas atividades" (O2).
 *
 * `rodape` recebe os botões, que mudam conforme o papel de quem olha: o aluno
 * vê "Ver detalhes", a ONG vê o ciclo de vida. O cartão não decide isso.
 */
export default function CartaoAtividade({ atividade, rodape, aoClicar }) {
  const {
    titulo, descricao, data, horaInicio, horaFim, local, cidade,
    cargaHoraria, vagasRestantes, vagasMax, lotada, exigeAprovacao, situacao, ong,
  } = atividade;

  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      className={aoClicar ? "mh-card-hover" : undefined}
      style={{ cursor: aoClicar ? "pointer" : "default", height: "100%" }}
      onClick={aoClicar}
    >
      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <div style={{ minWidth: 0 }}>
            <Title order={4} lineClamp={2} fz={17}>
              {titulo}
            </Title>
            {ong?.nome && (
              <Group gap={4} wrap="nowrap" mt={2}>
                <Text size="xs" c="dimmed" truncate>
                  {ong.nome}
                </Text>
                {ong.verificada && (
                  <Tooltip label="Organização verificada">
                    <IconCheck size={13} color="var(--mantine-color-brand-6)" />
                  </Tooltip>
                )}
              </Group>
            )}
          </div>
          <Stack gap={6} align="flex-end" style={{ flexShrink: 0 }}>
            <SituacaoBadge situacao={situacao} />
            <Badge color="clay" variant="light" radius="sm">
              {cargaHoraria}h
            </Badge>
          </Stack>
        </Group>

        <Stack gap={5}>
          <Linha icon={IconCalendar}>{formatDate(data)}</Linha>
          <Linha icon={IconClock}>
            {horaInicio} às {horaFim}
          </Linha>
          <Linha icon={IconMapPin}>{[local, cidade].filter(Boolean).join(" · ")}</Linha>
          <Linha icon={IconUsers}>
            {lotada
              ? `Vagas esgotadas (${vagasMax})`
              : `${vagasRestantes} de ${vagasMax} vagas`}
          </Linha>
        </Stack>

        {exigeAprovacao && (
          <Badge color="yellow" variant="light" radius="sm" w="fit-content">
            Aprovação necessária
          </Badge>
        )}

        {descricao && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {descricao}
          </Text>
        )}

        {rodape && <div style={{ marginTop: "auto", paddingTop: 4 }}>{rodape}</div>}
      </Stack>
    </Card>
  );
}
