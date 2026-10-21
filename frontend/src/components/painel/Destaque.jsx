import { Box, Button, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { useNavigate } from "react-router-dom";

/**
 * A ação mais urgente do momento, no pé da capa do painel.
 *
 * Uma faixa só, dentro do azul-noite: o que importa é o botão branco, e ele
 * fica sempre no mesmo lugar. Quando não há nada urgente o painel nem desenha
 * a faixa: o destaque "nenhum" vira o vazio das listas abaixo.
 */
export default function Destaque({ destaque, catalogo }) {
  const navegar = useNavigate();
  const modelo = catalogo[destaque?.tipo] ?? catalogo.nenhum;

  return (
    <Box className="mh-capa-destaque" role="region" aria-label="O que fazer agora">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start" style={{ flex: "1 1 320px" }}>
          <ThemeIcon size={40} radius="xl" color="rgba(255,255,255,0.12)" c="white"
                     style={{ flexShrink: 0 }} aria-hidden="true">
            <modelo.icone size={20} stroke={1.75} />
          </ThemeIcon>
          <Stack gap={2}>
            <Text fw={600} c="white">{destaque?.titulo}</Text>
            {destaque?.mensagem && (
              <Text size="sm" c="rgba(255,255,255,0.75)">{destaque.mensagem}</Text>
            )}
          </Stack>
        </Group>
        <Button variant="white" radius="xl" px="lg"
                onClick={() => navegar(modelo.destino(destaque))}>
          {modelo.rotulo}
        </Button>
      </Group>
    </Box>
  );
}
