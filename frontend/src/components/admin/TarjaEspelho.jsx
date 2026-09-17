import { useCallback, useEffect, useState } from "react";
import { Button, Group, Text } from "@mantine/core";
import { IconEye, IconLogout2 } from "@tabler/icons-react";

import { useAuth } from "../../context/AuthContext";
import { notifyInfo } from "../../utils/notify";
import { ROTULO_DO_PAPEL } from "../../pages/admin/rotulos";

function restante(expiraEm) {
  return Math.max(0, Math.floor((new Date(expiraEm).getTime() - Date.now()) / 1000));
}

function relogio(segundos) {
  const m = String(Math.floor(segundos / 60)).padStart(2, "0");
  const s = String(segundos % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Tarja do "entrar como" (A4b). Não fecha: enquanto ela estiver na tela, o
 * admin sabe que está vendo com os olhos de outra pessoa — e que tudo fica
 * registrado.
 */
export default function TarjaEspelho() {
  const { espelho, sairDoModo } = useAuth();
  const [segundos, setSegundos] = useState(() => restante(espelho.expiraEm));
  const [saindo, setSaindo] = useState(false);
  const alvoId = espelho.alvo.id;

  const encerrar = useCallback(async (avisarServidor, aviso) => {
    setSaindo(true);
    await sairDoModo({ avisarServidor, voltarPara: `/admin/usuarios/${alvoId}` });
    if (aviso) notifyInfo(aviso);
  }, [alvoId, sairDoModo]);

  useEffect(() => {
    const id = setInterval(() => {
      const agora = restante(espelho.expiraEm);
      setSegundos(agora);
      if (agora === 0) {
        clearInterval(id);
        encerrar(false, "O tempo do \"entrar como\" acabou. Você voltou à sua sessão.");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [espelho.expiraEm, encerrar]);

  // A API recusou o token espelho (expirou ou foi revogado em outra aba).
  useEffect(() => {
    const aoEncerrar = () =>
      encerrar(false, "O \"entrar como\" foi encerrado. Você voltou à sua sessão.");
    window.addEventListener("mh:espelho-encerrado", aoEncerrar);
    return () => window.removeEventListener("mh:espelho-encerrado", aoEncerrar);
  }, [encerrar]);

  return (
    <Group className="mh-tarja-espelho" h={44} px={{ base: "sm", md: "xl" }}
           justify="space-between" wrap="nowrap" gap="xs" role="status">
      <Group gap={8} wrap="nowrap" miw={0}>
        <IconEye size={18} style={{ flexShrink: 0 }} />
        <Text size="sm" fw={600} truncate>
          Vendo como <b>{espelho.alvo.nome}</b>
          <Text span visibleFrom="sm" inherit>
            {" "}({ROTULO_DO_PAPEL[espelho.alvo.papel] || espelho.alvo.papel})
            {" "}· somente leitura · registrado na auditoria
          </Text>
        </Text>
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" fw={700} ff="monospace" aria-label="Tempo restante">
          {relogio(segundos)}
        </Text>
        <Button size="compact-sm" color="dark" leftSection={<IconLogout2 size={14} />}
                loading={saindo} onClick={() => encerrar(true)}>
          Sair do modo
        </Button>
      </Group>
    </Group>
  );
}
