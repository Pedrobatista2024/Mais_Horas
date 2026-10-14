import { useEffect, useState } from "react";
import { Button, Divider, Stack, Text } from "@mantine/core";

import { api, API_URL } from "../../services/api";
import { comArtigo, PROVEDORES } from "./provedores";

/**
 * Entrada por Google, Microsoft e GitHub.
 *
 * Só aparece o provedor que o servidor tem credencial para atender: botão que
 * leva a uma tela de erro é pior que botão ausente. A navegação é de página
 * inteira, e não por requisição — o fluxo passa pelo site do provedor e volta
 * com o cookie.
 */
export default function BotoesExternos({ acao = "Entrar" }) {
  const [disponiveis, setDisponiveis] = useState([]);

  useEffect(() => {
    let ativo = true;
    api.get("/auth/provedores")
      .then(({ data }) => {
        if (ativo) setDisponiveis(PROVEDORES.filter((p) => data?.[p.chave]));
      })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  if (disponiveis.length === 0) return null;

  return (
    <>
      <Divider my="xs" label={<Text size="xs" c="dimmed">ou</Text>} labelPosition="center" />
      <Stack gap="xs">
        {disponiveis.map((p) => (
          <Button
            key={p.chave}
            variant="default"
            fullWidth
            leftSection={<p.icone size={18} />}
            onClick={() => { window.location.href = `${API_URL}/auth/${p.chave}/inicio`; }}
          >
            {acao} {comArtigo(p)}
          </Button>
        ))}
      </Stack>
    </>
  );
}
