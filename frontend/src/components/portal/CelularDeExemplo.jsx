import { Box } from "@mantine/core";

/**
 * Moldura de celular para mostrar uma tela do sistema no portal. O conteúdo
 * é montado com os mesmos componentes do app, em tamanho de celular.
 */
export default function CelularDeExemplo({ rotulo, children, deslocamento = 0 }) {
  return (
    <Box className="mh-celular" role="img" aria-label={rotulo}
         style={deslocamento ? { transform: `translateY(${deslocamento}px)` } : undefined}>
      <div className="mh-celular-barra" aria-hidden="true" />
      <Box px={14} pb={14} aria-hidden="true">{children}</Box>
    </Box>
  );
}
