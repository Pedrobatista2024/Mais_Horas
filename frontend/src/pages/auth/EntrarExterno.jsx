import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Paper, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconBuildingCommunity, IconSchool } from "@tabler/icons-react";

import { comArtigo, pelo, provedorPorChave, sujeito } from "../../components/auth/provedores";
import AuthLayout from "../../components/layout/AuthLayout";
import Loading from "../../components/ui/Loading";
import { useAuth } from "../../context/AuthContext";
import { destinoSeguro, painelDe } from "../../routes/destinos";
import { api, mensagemDoErro, renovarSessao } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

function Perfil({ icone: Icone, titulo, texto, cor, aoEscolher, enviando }) {
  return (
    <Paper withBorder p="lg" className="mh-card-hover">
      <Stack gap="sm" align="flex-start" h="100%">
        <ThemeIcon size={36} radius="md" variant="light" color={cor}>
          <Icone size={20} />
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
 * Volta do provedor externo (Google, Microsoft ou GitHub).
 *
 * Dois caminhos: quem já tem conta chega com o cookie de sessão pronto e só
 * precisa recolhê-lo; quem é novo escolhe o perfil aqui, porque nenhum
 * provedor sabe dizer se a pessoa é estudante ou organização.
 */
export default function EntrarExterno() {
  const navegar = useNavigate();
  const { provedor: chave } = useParams();
  const [parametros] = useSearchParams();
  const { entrar } = useAuth();
  const [enviando, setEnviando] = useState(null);

  const p = provedorPorChave(chave);
  const novo = parametros.get("novo") === "1";
  const volta = destinoSeguro(parametros.get("volta"));

  const recolherSessao = useCallback(async () => {
    try {
      const dados = await renovarSessao();
      entrar(dados);
      notifySuccess(`Bem-vindo(a), ${dados.usuario.nome}!`);
      navegar(volta ?? painelDe(dados.usuario.papel), { replace: true });
    } catch {
      notifyError(`A entrada ${pelo(p)} não foi concluída. Tente de novo.`);
      navegar("/entrar", { replace: true });
    }
  }, [entrar, navegar, volta, p]);

  useEffect(() => {
    if (p && !novo) recolherSessao();
  }, [p, novo, recolherSessao]);

  async function escolher(papel) {
    setEnviando(papel);
    try {
      const { data } = await api.post(`/auth/${p.chave}/concluir`, { papel });
      entrar(data);
      notifySuccess("Conta criada. Bem-vindo(a) ao Mais Horas!");
      navegar(painelDe(data.usuario.papel), { replace: true });
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível concluir o cadastro"));
      setEnviando(null);
    }
  }

  if (!p) return <Navigate to="/entrar" replace />;
  if (!novo) return <Loading label={`Entrando ${comArtigo(p)}...`} />;

  return (
    <AuthLayout title="Falta só uma escolha"
                subtitle={`${sujeito(p)} confirmou quem você é. Como você usa o Mais Horas?`}>
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
