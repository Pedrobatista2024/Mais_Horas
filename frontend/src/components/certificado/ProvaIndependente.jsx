import { useState } from "react";
import {
  Anchor, Button, Card, Code, CopyButton, Group, Spoiler, Stack, Text,
} from "@mantine/core";
import { IconCheck, IconCopy, IconKey, IconTerminal2 } from "@tabler/icons-react";

import { api, API_URL, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

function Copiar({ valor, rotulo }) {
  return (
    <CopyButton value={valor} timeout={1500}>
      {({ copied, copy }) => (
        <Button size="compact-sm" variant="subtle" onClick={copy}
                leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}>
          {copied ? "Copiado" : rotulo}
        </Button>
      )}
    </CopyButton>
  );
}

/**
 * "Não acredite em nós, confira você mesmo."
 *
 * Mostra a matéria-prima da assinatura — o texto exato que foi assinado, a
 * assinatura e a chave pública — para que a conferência possa ser refeita fora
 * daqui. Uma verificação que só o próprio emissor sabe fazer não prova nada.
 */
export default function ProvaIndependente({ codigo }) {
  const [prova, setProva] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function buscar() {
    setCarregando(true);
    try {
      const { data } = await api.get(`/certificados/verificar/${codigo}/prova`);
      setProva(data);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível carregar a prova"));
    } finally {
      setCarregando(false);
    }
  }

  const comando = `python verificar_certificado.py ${codigo}`;

  return (
    <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
      <Group justify="space-between" wrap="wrap" gap="sm" mb="sm">
        <div>
          <Text fw={700}>Conferir por conta própria</Text>
          <Text size="sm" c="dimmed" maw={520}>
            A validade não depende desta página. Com o texto assinado, a assinatura e
            a chave pública, qualquer pessoa refaz a conferência no próprio computador.
          </Text>
        </div>
        {!prova && (
          <Button variant="light" loading={carregando} onClick={buscar}
                  leftSection={<IconKey size={16} />}>
            Ver a prova
          </Button>
        )}
      </Group>

      {prova && (
        <Stack gap="md" mt="md">
          <div>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
              Texto assinado ({prova.formatoDoTexto})
            </Text>
            <Spoiler maxHeight={68} showLabel="Ver tudo" hideLabel="Recolher">
              <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {prova.textoAssinado}
              </Code>
            </Spoiler>
            <Copiar valor={prova.textoAssinado} rotulo="Copiar texto" />
          </div>

          <div>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
              Assinatura ({prova.algoritmo})
            </Text>
            <Code block style={{ wordBreak: "break-all" }}>{prova.assinatura}</Code>
            <Group gap={4}>
              <Copiar valor={prova.assinatura} rotulo="Copiar assinatura" />
              <Anchor href={`${API_URL}/portal/chave-publica`} target="_blank"
                      rel="noopener noreferrer" size="sm" fw={600}>
                Baixar chave pública
              </Anchor>
            </Group>
          </div>

          <div>
            <Group gap={6} mb={4}>
              <IconTerminal2 size={15} />
              <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                Conferir pelo terminal
              </Text>
            </Group>
            <Code block>{comando}</Code>
            <Text size="xs" c="dimmed" mt={4}>
              O verificador está em <b>scripts/verificar_certificado.py</b> no
              repositório do projeto. Ele só precisa da biblioteca{" "}
              <Code>cryptography</Code> e funciona sem acesso a este site, a partir
              de uma prova salva.
            </Text>
          </div>

          <Text size="xs" c="dimmed">
            Impressão digital da chave: <Code>{prova.impressaoDigitalDaChave}</Code> —
            a mesma impressa no rodapé do certificado.
          </Text>
        </Stack>
      )}
    </Card>
  );
}
