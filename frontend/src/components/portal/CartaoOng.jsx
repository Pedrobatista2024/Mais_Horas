import { Avatar, Box, Group, Text, Tooltip } from "@mantine/core";
import { IconBuildingCommunity, IconRosetteDiscountCheckFilled } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { resolveImage } from "../../utils/format";

/**
 * Organização em T5 e na página inicial. O nome é o link e cobre o bloco
 * inteiro; o que a ONG já fez vem em texto, não em selo colorido.
 */
export default function CartaoOng({ ong }) {
  const lugar = [ong.cidade, ong.estado].filter(Boolean).join(", ");
  const feitos = [
    ong.atividadesRealizadas > 0 && `${ong.atividadesRealizadas} ${ong.atividadesRealizadas === 1 ? "atividade realizada" : "atividades realizadas"}`,
    ong.atividadesAbertas > 0 && `${ong.atividadesAbertas} ${ong.atividadesAbertas === 1 ? "vaga aberta" : "vagas abertas"}`,
  ].filter(Boolean);

  return (
    <Box className="mh-bloco mh-cartao-atividade" p="md" h="100%">
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Avatar src={resolveImage(ong.logo)} size={44} radius="sm" color="navy"
                alt={`Logo de ${ong.nome}`}>
          <IconBuildingCommunity size={22} />
        </Avatar>
        <Box style={{ minWidth: 0 }}>
          <Group gap={5} wrap="nowrap">
            <Text fw={600} lineClamp={1} component={Link} to={`/ongs/${ong.id}`}
                  className="mh-link-titulo">
              {ong.nome}
            </Text>
            {ong.verificada && (
              <Tooltip label="Organização verificada pela Mais Horas">
                <IconRosetteDiscountCheckFilled size={16} color="var(--mh-royal)"
                                               aria-label="verificada" style={{ flexShrink: 0 }} />
              </Tooltip>
            )}
          </Group>
          {lugar && <Text size="sm" c="dimmed">{lugar}</Text>}
        </Box>
      </Group>

      {ong.descricao && (
        <Text size="sm" c="dimmed" lineClamp={3} mt="sm">{ong.descricao}</Text>
      )}
      {feitos.length > 0 && (
        <Text size="sm" mt="sm" className="mh-num">{feitos.join(", ")}</Text>
      )}
    </Box>
  );
}
