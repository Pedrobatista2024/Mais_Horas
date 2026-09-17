import { Avatar, Badge, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconBuildingCommunity, IconCircleCheckFilled, IconMapPin } from "@tabler/icons-react";

import { resolveImage } from "../../utils/format";

/** Cartão de organização em T5 e na página inicial. */
export default function CartaoOng({ ong, aoClicar }) {
  const lugar = [ong.cidade, ong.estado].filter(Boolean).join(" · ");

  return (
    <Card withBorder radius="lg" padding="lg" h="100%" className="mh-card-hover"
          style={{ cursor: "pointer" }} onClick={aoClicar}
          role="link" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") aoClicar(); }}>
      <Stack gap="sm" h="100%">
        <Group gap="sm" wrap="nowrap">
          <Avatar src={resolveImage(ong.logo)} size={52} radius="md" color="navy">
            <IconBuildingCommunity size={26} />
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Group gap={5} wrap="nowrap">
              <Text fw={800} lineClamp={1}>{ong.nome}</Text>
              {ong.verificada && (
                <Tooltip label="Organização verificada pela administração">
                  <IconCircleCheckFilled size={17} color="var(--mantine-color-brand-6)"
                                         style={{ flexShrink: 0 }} />
                </Tooltip>
              )}
            </Group>
            {lugar && (
              <Group gap={4} c="dimmed" wrap="nowrap">
                <IconMapPin size={13} />
                <Text size="xs" truncate>{lugar}</Text>
              </Group>
            )}
          </div>
        </Group>

        <Text size="sm" c="dimmed" lineClamp={3} style={{ flex: 1 }}>
          {ong.descricao || "Organização parceira do Mais Horas."}
        </Text>

        <Group gap="xs">
          {ong.atividadesRealizadas > 0 && (
            <Badge variant="light" color="navy" radius="sm">
              {ong.atividadesRealizadas}{" "}
              {ong.atividadesRealizadas === 1 ? "atividade realizada" : "atividades realizadas"}
            </Badge>
          )}
          {ong.atividadesAbertas > 0 && (
            <Badge variant="light" color="brand" radius="sm">
              {ong.atividadesAbertas}{" "}
              {ong.atividadesAbertas === 1 ? "vaga aberta" : "vagas abertas"}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
