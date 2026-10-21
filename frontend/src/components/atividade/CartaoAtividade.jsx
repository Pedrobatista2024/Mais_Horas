import { Badge, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconRosetteDiscountCheckFilled } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { formatHorario } from "../../utils/format";
import DataBloco from "../ui/DataBloco";
import Horas from "../ui/Horas";
import SituacaoBadge from "./SituacaoBadge";
import { textoDeVagas } from "./vagas";

/**
 * Atividade na vitrine (E2), onde a pessoa escolhe entre vagas.
 *
 * A data vem na frente, em bloco, porque é por ela que se decide se dá para ir.
 * A situação só aparece quando foge do normal: na vitrine tudo está publicado,
 * e um selo "Publicada" em cada cartão não diz nada.
 *
 * `para` vira link no título, e o link cobre o cartão inteiro (o `::after` do
 * título se estica por cima), então o cartão todo é clicável sem virar um
 * `div` com `onClick`. `rodape` recebe a ação e fica por cima do link.
 */
export default function CartaoAtividade({ atividade, para, rodape }) {
  const {
    titulo, descricao, data, horaInicio, horaFim, local, cidade,
    cargaHoraria, exigeAprovacao, situacao, ong,
  } = atividade;

  return (
    <Box className="mh-bloco mh-cartao-atividade" p="md" h="100%">
      <Group align="flex-start" gap="md" wrap="nowrap" h="100%">
        <DataBloco data={data} />

        <Stack gap={8} style={{ flex: 1, minWidth: 0 }} h="100%">
          <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
            <Box style={{ minWidth: 0 }}>
              <Text fw={600} fz="lg" lh={1.3} lineClamp={2}
                    component={para ? Link : "span"} to={para}
                    className={para ? "mh-link-titulo" : undefined}>
                {titulo}
              </Text>
              {ong?.nome && (
                <Group gap={4} wrap="nowrap" mt={2}>
                  <Text size="sm" c="dimmed" truncate>{ong.nome}</Text>
                  {ong.verificada && (
                    <Tooltip label="Organização verificada pela Mais Horas">
                      <IconRosetteDiscountCheckFilled size={15} aria-label="verificada"
                                                     color="var(--mh-royal)"
                                                     style={{ flexShrink: 0 }} />
                    </Tooltip>
                  )}
                </Group>
              )}
            </Box>
            <Horas valor={cargaHoraria} />
          </Group>

          <Box>
            <Text size="sm">{formatHorario(horaInicio, horaFim)}</Text>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {[local, cidade].filter(Boolean).join(", ")}
            </Text>
          </Box>

          {(situacao !== "publicada" || exigeAprovacao) && (
            <Group gap={6}>
              {situacao !== "publicada" && <SituacaoBadge situacao={situacao} />}
              {exigeAprovacao && <Badge color="gray">Com aprovação da ONG</Badge>}
            </Group>
          )}

          {descricao && (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {descricao}
            </Text>
          )}

          <Group justify="space-between" align="center" gap="sm" mt="auto" pt={4}
                 wrap="wrap">
            <Text size="sm" c={atividade.lotada ? "red.8" : "dimmed"} className="mh-num">
              {textoDeVagas(atividade)}
            </Text>
            {rodape && <Box className="mh-acima-do-link">{rodape}</Box>}
          </Group>
        </Stack>
      </Group>
    </Box>
  );
}
