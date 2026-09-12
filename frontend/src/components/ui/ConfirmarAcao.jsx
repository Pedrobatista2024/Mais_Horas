import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useState } from "react";

/**
 * Confirmação para ação que não dá para desfazer.
 *
 * Com `pedirMotivo`, o texto digitado volta em `aoConfirmar(motivo)`. O motivo
 * é opcional de propósito: ele vai para a trilha de auditoria, não para o aluno
 * (D10), então travar a ação por causa dele só atrapalharia a ONG.
 */
export default function ConfirmarAcao({
  aberto, aoFechar, aoConfirmar, titulo, mensagem,
  rotuloConfirmar = "Confirmar", cor = "red", pedirMotivo = false,
  rotuloMotivo = "Motivo (opcional)",
}) {
  const [motivo, setMotivo] = useState("");
  const [processando, setProcessando] = useState(false);

  async function confirmar() {
    setProcessando(true);
    try {
      await aoConfirmar(motivo.trim() || null);
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

        {pedirMotivo && (
          <Textarea
            label={rotuloMotivo}
            description="Fica registrado no histórico. O aluno não vê este texto."
            placeholder="Ex.: previsão de chuva forte"
            minRows={2}
            autosize
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.currentTarget.value)}
          />
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={fechar} disabled={processando}>
            Voltar
          </Button>
          <Button color={cor} onClick={confirmar} loading={processando}>
            {rotuloConfirmar}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
