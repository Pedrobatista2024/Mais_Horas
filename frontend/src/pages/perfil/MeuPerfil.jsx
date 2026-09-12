import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert, Anchor, Button, Card, Divider, Group, SimpleGrid, Stack, Text,
  TextInput, Textarea, Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertTriangle, IconArrowLeft, IconCheck } from "@tabler/icons-react";

import FotoPerfil from "../../components/perfil/FotoPerfil";
import PublicPage from "../../components/layout/PublicPage";
import Loading from "../../components/ui/Loading";
import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

/** Rótulos dos campos que a RN-13 exige antes da primeira inscrição. */
const ROTULO_OBRIGATORIO = {
  nome_completo: "nome completo",
  instituicao: "instituição",
  curso: "curso",
};

const VAZIO_ESTUDANTE = {
  nome_completo: "", instituicao: "", curso: "", telefone: "",
  cidade: "", estado: "", bairro: "", sobre_mim: "", linkedin: "",
};

const VAZIO_ONG = {
  nome_organizacao: "", cnpj: "", descricao: "", telefone: "",
  site: "", instagram: "", endereco: "", cidade: "", estado: "",
};

/** E7 / O8 — Meu perfil. A mesma tela serve aos dois papéis. */
export default function MeuPerfil() {
  const { usuario, atualizarUsuario } = useAuth();
  const eOng = usuario?.papel === "ong";

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [perfil, setPerfil] = useState(null);

  const form = useForm({
    initialValues: eOng ? VAZIO_ONG : VAZIO_ESTUDANTE,
  });

  function aplicar(dados) {
    setPerfil(dados);
    atualizarUsuario({
      id: dados.id, nome: dados.nome, email: dados.email, papel: dados.papel,
    });
    const base = eOng ? VAZIO_ONG : VAZIO_ESTUDANTE;
    const valores = {};
    for (const campo of Object.keys(base)) {
      valores[campo] = dados.perfil?.[campo] ?? "";
    }
    form.setValues(valores);
    form.resetDirty(valores);
  }

  useEffect(() => {
    let ativo = true;
    api
      .get("/perfil")
      .then(({ data }) => ativo && aplicar(data))
      .catch((erro) => notifyError(mensagemDoErro(erro, "Não foi possível carregar o perfil")))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(valores) {
    setSalvando(true);
    try {
      const { data } = await api.put("/perfil", valores);
      aplicar(data);
      notifySuccess("Perfil atualizado");
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível salvar"));
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) return <Loading label="Carregando perfil..." />;

  const faltantes = perfil?.camposFaltantes ?? [];

  return (
    <PublicPage>
      <Stack gap="lg" maw={720} mx="auto" w="100%">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Anchor component={Link} to={painelDe(usuario?.papel)} size="sm">
            <Group gap={4}>
              <IconArrowLeft size={15} />
              Voltar ao painel
            </Group>
          </Anchor>
        </Group>

        <Stack gap={4}>
          <Text tt="uppercase" c="brand.7" fw={700} size="xs">
            {eOng ? "Perfil da organização" : "Meu perfil"}
          </Text>
          <Title order={2} fz={{ base: 26, sm: 32 }}>
            {eOng ? "Dados da ONG" : "Seus dados"}
          </Title>
        </Stack>

        {!eOng && faltantes.length > 0 && (
          <Alert icon={<IconAlertTriangle size={18} />} color="clay" variant="light">
            Para se inscrever em atividades, preencha{" "}
            <b>{faltantes.map((c) => ROTULO_OBRIGATORIO[c] || c).join(", ")}</b>.
          </Alert>
        )}

        {!eOng && perfil?.perfilCompleto && (
          <Alert icon={<IconCheck size={18} />} color="brand" variant="light">
            Perfil completo. Você já pode se inscrever em atividades.
          </Alert>
        )}

        <Card withBorder radius="md" p={{ base: "lg", sm: "xl" }}>
          <FotoPerfil
            nome={perfil?.nome}
            caminho={eOng ? perfil?.perfil?.logo : perfil?.perfil?.foto}
            rotulo={eOng ? "logo" : "foto"}
            aoAtualizar={aplicar}
          />

          <Divider my="lg" />

          <form onSubmit={form.onSubmit(salvar)}>
            <Stack>
              {eOng ? (
                <>
                  <TextInput label="Nome da organização" placeholder="ONG Verde Vida"
                    {...form.getInputProps("nome_organizacao")} />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput label="CNPJ" placeholder="00.000.000/0001-00"
                      {...form.getInputProps("cnpj")} />
                    <TextInput label="Telefone" placeholder="(85) 99999-9999"
                      {...form.getInputProps("telefone")} />
                  </SimpleGrid>
                  <Textarea label="Descrição" minRows={3} autosize
                    placeholder="Conte o que a sua organização faz"
                    {...form.getInputProps("descricao")} />
                  <TextInput label="Endereço" placeholder="Rua, número, bairro"
                    {...form.getInputProps("endereco")} />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput label="Cidade" {...form.getInputProps("cidade")} />
                    <TextInput label="Estado" {...form.getInputProps("estado")} />
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput label="Site" placeholder="https://..."
                      {...form.getInputProps("site")} />
                    <TextInput label="Instagram" placeholder="@suaong"
                      {...form.getInputProps("instagram")} />
                  </SimpleGrid>
                </>
              ) : (
                <>
                  <TextInput
                    label="Nome completo"
                    placeholder="Como aparecerá no seu certificado"
                    description="É este nome que vai no certificado"
                    withAsterisk
                    {...form.getInputProps("nome_completo")}
                  />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput label="Instituição" placeholder="UniC" withAsterisk
                      {...form.getInputProps("instituicao")} />
                    <TextInput label="Curso" placeholder="Sistemas de Informação"
                      withAsterisk {...form.getInputProps("curso")} />
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput label="Telefone" placeholder="(85) 99999-9999"
                      {...form.getInputProps("telefone")} />
                    <TextInput label="LinkedIn" placeholder="linkedin.com/in/voce"
                      {...form.getInputProps("linkedin")} />
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput label="Cidade" {...form.getInputProps("cidade")} />
                    <TextInput label="Estado" {...form.getInputProps("estado")} />
                    <TextInput label="Bairro" {...form.getInputProps("bairro")} />
                  </SimpleGrid>
                  <Textarea label="Sobre mim" minRows={3} autosize
                    placeholder="Fale um pouco sobre você para as ONGs"
                    {...form.getInputProps("sobre_mim")} />
                </>
              )}

              <Group justify="flex-end" mt="sm">
                <Button type="submit" loading={salvando} disabled={!form.isDirty()}>
                  Salvar alterações
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </PublicPage>
  );
}
