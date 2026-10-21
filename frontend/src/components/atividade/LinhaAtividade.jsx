import { ActionIcon, Box, Button, Group, Menu, Text } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { Link } from "react-router-dom";

import { formatHorario } from "../../utils/format";
import DataBloco from "../ui/DataBloco";
import Horas from "../ui/Horas";
import SituacaoBadge from "./SituacaoBadge";

/**
 * Uma atividade como **linha** de lista, para quem administra (O2).
 *
 * A ONG já conhece a atividade e quer achar uma no meio de trinta e agir.
 * Então cada informação tem sua coluna — data, atividade, horário, horas,
 * vagas — e no computador as colunas se alinham de uma linha para a outra,
 * como numa tabela. No celular viram duas linhas de texto.
 *
 * Uma ação visível (a que faz sentido naquela situação), o resto no menu. O
 * título é o link para a atividade e cobre a linha toda.
 *
 * `comSituacao={false}` esconde o selo quando a lista já é de uma situação só
 * (as abas de O2): "Publicada" em todas as linhas da aba Publicadas não diz nada.
 */
export default function LinhaAtividade({
  atividade, para, acao, menu = [], comSituacao = true,
}) {
  const {
    titulo, data, horaInicio, horaFim, cargaHoraria,
    vagasOcupadas, vagasMax, local, situacao,
  } = atividade;

  const itens = menu.filter(Boolean);

  return (
    <Box className="mh-linha mh-linha-atividade">
      <DataBloco data={data} />

      <Box className="mh-la-principal">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600} truncate component={Link} to={para} className="mh-link-titulo">
            {titulo}
          </Text>
          {comSituacao && <SituacaoBadge situacao={situacao} style={{ flexShrink: 0 }} />}
        </Group>
        <Text size="sm" c="dimmed" truncate>{local}</Text>
      </Box>

      <Box className="mh-la-meta">
        <Text size="sm" className="mh-la-horario">{formatHorario(horaInicio, horaFim)}</Text>
        <Box className="mh-la-horas"><Horas valor={cargaHoraria} /></Box>
        <Text size="sm" c="dimmed" className="mh-la-vagas mh-num"
              aria-label={`${vagasOcupadas} de ${vagasMax} vagas ocupadas`}>
          {vagasOcupadas}/{vagasMax} vagas
        </Text>
      </Box>

      <Group gap={6} wrap="nowrap" className="mh-la-acoes mh-acima-do-link">
        {acao && (
          <Button size="xs" variant={acao.variante || "default"}
                  leftSection={acao.icone ? <acao.icone size={14} /> : undefined}
                  onClick={acao.aoClicar}>
            {acao.rotulo}
          </Button>
        )}

        {itens.length > 0 && (
          <Menu position="bottom-end" withinPortal shadow="sm" width={220}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Mais ações: ${titulo}`}>
                <IconDots size={17} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {itens.map((item) => (
                <Menu.Item key={item.rotulo} color={item.cor}
                           leftSection={item.icone ? <item.icone size={15} /> : undefined}
                           onClick={item.aoClicar}>
                  {item.rotulo}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Box>
  );
}
