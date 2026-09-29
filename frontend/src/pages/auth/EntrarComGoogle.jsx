import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconBuildingCommunity, IconSchool } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import Loading from "../../components/ui/Loading";
import { useAuth } from "../../context/AuthContext";
import { destinoSeguro, painelDe } from "../../routes/destinos";
import { api, mensagemDoErro, renovarSessao } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

function Perfil({ icone: Icone, titulo, texto, cor, aoEscolher, enviando }) {
  return (
    <Paper withBorder radius="md" p="lg" className="mh-card-hover">
      <Stack gap="sm" align="flex-start" h="100%">
        <ThemeIcon size={46} radius="md" variant="light" color={cor}>
          <Icone size={26} />
        </ThemeIcon>
        <div>
          <Text fw={600}>{titulo}</Text>
          <Text size="sm" c="dimmed">{texto}</Text>
        </div>
        <Button color={cor} variant="light" fullWidth mt="auto" loading={enviando}
                onClick={aoEscolher}>
          Sou {titulo.toLowerCase()}
        </Button>
      </Stack>
    </Paper>
  );
}

/**
 * Volta do Google.
 *
 * Dois caminhos: quem já tem conta chega com o cookie de sessão pronto e só
 * precisa recolhê-lo; quem é novo escolhe o perfil aqui, porque o Google não
 * sabe dizer se a pessoa é estudante ou organização.
 */
export default function EntrarComGoogle() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const { entrar } = useAuth();
  const [enviando, setEnviando] = useState(null);

  const novo = parametros.get("novo") === "1";
  const volta = destinoSeguro(parametros.get("volta"));

  const recolherSessao = useCallback(async () => {
    try {
      const dados = await renovarSessao();
      entrar(dados);
      notifySuccess(`Bem-vindo(a), ${dados.usuario.nome}!`);
      navegar(volta ?? painelDe(dados.usuario.papel), { replace: true });
    } catch {
      notifyError("A entrada pelo Google não foi concluída. Tente de novo.");
      navegar("/entrar", { replace: true });
    }
  }, [entrar, navegar, volta]);

  useEffect(() => {
    if (!novo) recolherSessao();
  }, [novo, recolherSessao]);

  async function escolher(papel) {
    setEnviando(papel);
    try {
      const { data } = await api.post("/auth/google/concluir", { papel });
      entrar(data);
      notifySuccess("Conta criada. Bem-vindo(a) ao Mais Horas!");
      navegar(painelDe(data.usuario.papel), { replace: true });
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível concluir o cadastro"));
      setEnviando(null);
    }
  }

  if (!novo) return <Loading label="Entrando com o Google..." />;

  return (
    <AuthLayout title="Falta só uma escolha"
                subtitle="O Google confirmou quem você é. Como você usa o Mais Horas?">
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Perfil icone={IconSchool} cor="brand" titulo="Estudante"
                  texto="Quero cumprir horas de extensão e receber certificados."
                  enviando={enviando === "estudante"}
                  aoEscolher={() => escolher("estudante")} />
          <Perfil icone={IconBuildingCommunity} cor="navy" titulo="ONG"
                  texto="Quero publicar atividades e receber voluntários."
                  enviando={enviando === "ong"}
                  aoEscolher={() => escolher("ong")} />
        </SimpleGrid>
        <Text size="xs" c="dimmed" ta="center">
          Dá para mudar depois? Não: o perfil define o que a conta faz. Se errar,
          fale com a administração.
        </Text>
      </Stack>
    </AuthLayout>
  );
}
