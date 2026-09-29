import {
  ActionIcon, Box, Button, Group, Menu, Text, Tooltip,
} from "@mantine/core";
import { IconChevronRight, IconDots } from "@tabler/icons-react";

import { formatDate } from "../../utils/format";
import SituacaoBadge from "./SituacaoBadge";

/**
 * Uma atividade como **linha** de lista, para quem administra (O2).
 *
 * O cartão continua certo na vitrine, onde a pessoa está escolhendo entre
 * vagas e quer ler a descrição. Para a ONG a tarefa é outra: ela já conhece a
 * atividade e quer achar uma no meio de trinta e agir. Cartão com pilha de
 * botões dentro transforma isso numa parede — cada cartão repete os mesmos
 * cinco botões e o olho não tem onde descansar.
 *
 * Então: uma linha por atividade, uma ação visível (a que faz sentido naquela
 * situação) e o resto no menu de três pontos.
 */
export default function LinhaAtividade({ atividade, aoAbrir, acao, menu = [] }) {
  const {
    titulo, data, horaInicio, horaFim, cargaHoraria,
    vagasOcupadas, vagasMax, local, situacao,
  } = atividade;

  const itens = menu.filter(Boolean);

  return (
    <Box
      className="mh-linha"
      onClick={aoAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") aoAbrir?.();
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Box style={{ flex: "1 1 320px", minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap" align="center">
            <Text fw={600} truncate>
              {titulo}
            </Text>
            <SituacaoBadge situacao={situacao} style={{ flexShrink: 0 }} />
          </Group>
          <Text size="sm" c="dimmed" truncate mt={2}>
            {[
              formatDate(data),
              `${horaInicio}–${horaFim}`,
              `${cargaHoraria}h`,
              `${vagasOcupadas}/${vagasMax} vagas`,
              local,
            ].filter(Boolean).join("  ·  ")}
          </Text>
        </Box>

        <Group gap={6} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          {acao && (
            <Button size="xs" variant={acao.variante || "default"}
                    leftSection={acao.icone ? <acao.icone size={14} /> : undefined}
                    onClick={acao.aoClicar}>
              {acao.rotulo}
            </Button>
          )}

          {itens.length > 0 && (
            <Menu position="bottom-end" withinPortal shadow="sm" width={210}>
              <Menu.Target>
                <Tooltip label="Mais ações">
                  <ActionIcon variant="subtle" color="gray" aria-label="Mais ações">
                    <IconDots size={17} />
                  </ActionIcon>
                </Tooltip>
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

          <IconChevronRight size={16} className="mh-linha-seta" />
        </Group>
      </Group>
    </Box>
  );
}
