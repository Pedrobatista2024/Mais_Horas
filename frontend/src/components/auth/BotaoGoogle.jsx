import { useEffect, useState } from "react";
import { Button, Divider, Text } from "@mantine/core";

import { api, API_URL } from "../../services/api";

/** O "G" oficial, em SVG: a marca do Google não pode ser redesenhada. */
function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.8 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.4c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.2 0 20 0 23.7s.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.4-2 15.2-5.5l-7.6-5.9c-2.1 1.4-4.8 2.3-7.6 2.3-6.4 0-11.7-4.3-13.6-10.1l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  );
}

/**
 * Entrada pelo Google.
 *
 * Só aparece se o servidor tiver as credenciais: botão que leva a uma tela de
 * erro é pior que botão ausente. A navegação é de página inteira, e não por
 * requisição — o fluxo passa pelo site do Google e volta com o cookie.
 */
export default function BotaoGoogle({ rotulo = "Entrar com o Google" }) {
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    let ativo = true;
    api.get("/auth/provedores")
      .then(({ data }) => { if (ativo) setDisponivel(Boolean(data?.google)); })
      .catch(() => {});
    return () => { ativo = false; };
  }, []);

  if (!disponivel) return null;

  return (
    <>
      <Divider my="xs" label={<Text size="xs" c="dimmed">ou</Text>} labelPosition="center" />
      <Button
        variant="default"
        fullWidth
        leftSection={<IconeGoogle />}
        onClick={() => { window.location.href = `${API_URL}/auth/google/inicio`; }}
      >
        {rotulo}
      </Button>
    </>
  );
}
