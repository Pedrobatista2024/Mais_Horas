import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router-dom";

/**
 * A ação mais urgente do momento, no topo do painel.
 *
 * Uma barra só, com fio azul à esquerda: o que importa é o botão, e ele fica
 * sempre no mesmo lugar. Quando não há nada urgente o painel nem desenha a
 * barra — o destaque "nenhum" vira o vazio das listas abaixo.
 */
export default function Destaque({ destaque, catalogo }) {
  const navegar = useNavigate();
  const modelo = catalogo[destaque?.tipo] ?? catalogo.nenhum;

  return (
    <Box className="mh-bloco" p="md" pl={20}
         style={{ borderLeft: "3px solid var(--mh-royal)" }}
         role="region" aria-label="O que fazer agora">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="sm" wrap="nowrap" align="flex-start" style={{ flex: "1 1 320px" }}>
          <modelo.icone size={22} stroke={1.75} color="var(--mh-royal)"
                        style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <Stack gap={2}>
            <Text fw={600}>{destaque?.titulo}</Text>
            {destaque?.mensagem && (
              <Text size="sm" c="dimmed">{destaque.mensagem}</Text>
            )}
          </Stack>
        </Group>
        <Button onClick={() => navegar(modelo.destino(destaque))}>
          {modelo.rotulo}
        </Button>
      </Group>
    </Box>
  );
}
