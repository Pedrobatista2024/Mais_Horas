import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useState } from "react";

/** Mínimo que a API aceita quando o motivo é obrigatório. */
const MINIMO_DO_MOTIVO = 5;

/**
 * Confirmação para ação que não dá para desfazer.
 *
 * Com `pedirMotivo`, o texto digitado volta em `aoConfirmar(motivo)`.
 *
 * - Para a ONG o motivo é **opcional**: ele vai para a auditoria, não para o
 *   aluno (D10), e travar a ação por causa dele só atrapalharia.
 * - Para o admin ele é **obrigatório** (`motivoObrigatorio`): suspender,
 *   revogar ou forçar validação sem justificar deixaria a trilha muda.
 *
 * `children` entra entre a mensagem e o motivo — é onde vai, por exemplo, a
 * escolha da política ao forçar uma validação.
 */
export default function ConfirmarAcao({
  aberto, aoFechar, aoConfirmar, titulo, mensagem, children,
  rotuloConfirmar = "Confirmar", cor = "red", pedirMotivo = false,
  motivoObrigatorio = false, rotuloMotivo,
  descricaoMotivo = "Fica registrado no histórico. O aluno não vê este texto.",
  podeConfirmar = true,
}) {
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);

  const limpo = motivo.trim();
  const faltaMotivo = motivoObrigatorio && limpo.length < MINIMO_DO_MOTIVO;

  async function confirmar() {
    setProcessando(true);
    try {
      await aoConfirmar(limpo || null);
      setMotivo("");
      aoFechar();
    } finally {
      setProcessando(false);
    }
  }

  function fechar() {
    if (processando) return;
    setMotivo("");
    aoFechar();
  }

  return (
    <Modal opened={aberto} onClose={fechar} title={titulo} centered radius="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {mensagem}
        </Text>

        {children}

        {(pedirMotivo || motivoObrigatorio) && (
          <Textarea
            label={rotuloMotivo ?? (motivoObrigatorio ? "Motivo" : "Motivo (opcional)")}
            description={descricaoMotivo}
            placeholder="Ex.: previsão de chuva forte"
            withAsterisk={motivoObrigatorio}
            minRows={2}
            autosize
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
            error={motivoObrigatorio && limpo.length > 0 && faltaMotivo
              ? `Escreva pelo menos ${MINIMO_DO_MOTIVO} caracteres` : null}
          />
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={fechar} disabled={processando}>
            Voltar
          </Button>
          <Button color={cor} onClick={confirmar} loading={processando}
                  disabled={faltaMotivo || !podeConfirmar}>
            {rotuloConfirmar}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
