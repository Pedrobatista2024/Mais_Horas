import { useRef, useState } from "react";
import { Avatar, Button, Group, Stack, Text } from "@mantine/core";
import { IconCamera, IconTrash } from "@tabler/icons-react";

import { api, mensagemDoErro } from "../../services/api";
import { initials, resolveImage } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";

/** Envio e remoção da foto (ou logo). Compartilhado por estudante e ONG. */
export default function FotoPerfil({ nome, caminho, aoAtualizar, rotulo = "foto" }) {
  const entrada = useRef(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    const dados = new FormData();
    dados.append("foto", arquivo);

    setEnviando(true);
    try {
      const { data } = await api.post("/perfil/foto", dados, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      aoAtualizar(data);
      notifySuccess(`Sua ${rotulo} foi atualizada`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, `Não foi possível enviar a ${rotulo}`));
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setEnviando(true);
    try {
      const { data } = await api.delete("/perfil/foto");
      aoAtualizar(data);
      notifySuccess(`Sua ${rotulo} foi removida`);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, `Não foi possível remover a ${rotulo}`));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Group wrap="wrap" gap="lg">
      <Avatar src={resolveImage(caminho)} size={88} radius="50%" color="brand">
        {initials(nome || "")}
      </Avatar>

      <Stack gap={6}>
        <Group gap="xs" wrap="wrap">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCamera size={15} />}
            loading={enviando}
            onClick={() => entrada.current?.click()}
          >
            {caminho ? `Trocar ${rotulo}` : `Enviar ${rotulo}`}
          </Button>
          {caminho && (
            <Button
              size="xs"
              variant="subtle"
              color="ink"
              leftSection={<IconTrash size={15} />}
              onClick={remover}
              disabled={enviando}
            >
              Remover
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          JPG, PNG, WebP ou GIF, até 2 MB.
        </Text>
      </Stack>

      <input ref={entrada} type="file" accept="image/*" hidden onChange={enviar} />
    </Group>
  );
}
