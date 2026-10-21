import { useEffect, useState } from "react";
import {
  Alert, Button, Group, SimpleGrid, Stack, Text, TextInput, Textarea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertTriangle, IconSchool } from "@tabler/icons-react";

import FotoPerfil from "../../components/perfil/FotoPerfil";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import SecaoDeFormulario from "../../components/ui/SecaoDeFormulario";
import { useAuth } from "../../context/AuthContext";
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

  if (carregando) return <Loading label="Carregando perfil…" />;

  const faltantes = perfil?.camposFaltantes ?? [];

  return (
    <>
      <PageHeader title={eOng ? "Perfil da organização" : "Meu perfil"}
                  subtitle={eOng
                    ? "Estes dados aparecem na página pública da sua organização."
                    : "Nome completo, instituição e curso são o que sai no certificado."} />

      <Stack gap="md" mb="xl">
        {perfil?.vinculoInstitucional && (
          <Alert icon={<IconSchool size={18} />} color="brand"
                 title="Vínculo institucional verificado">
            Você entrou com a conta <b>{perfil.vinculoInstitucional}</b>. Quem receber seus
            certificados sabe que a identidade foi confirmada pela instituição, e não só
            por nós.
          </Alert>
        )}

        {!eOng && faltantes.length > 0 && (
          <Alert icon={<IconAlertTriangle size={18} />} color="orange">
            Para se inscrever em atividades, preencha{" "}
            <b>{faltantes.map((c) => ROTULO_OBRIGATORIO[c] || c).join(", ")}</b>.
          </Alert>
        )}
      </Stack>

      <form onSubmit={form.onSubmit(salvar)}>
        <SecaoDeFormulario titulo={eOng ? "Logo" : "Foto"}
               texto={eOng ? "Aparece na lista de organizações parceiras."
                           : "Opcional. Só as ONGs das suas inscrições veem."}>
          <FotoPerfil
            nome={perfil?.nome}
            caminho={eOng ? perfil?.perfil?.logo : perfil?.perfil?.foto}
            rotulo={eOng ? "logo" : "foto"}
            aoAtualizar={aplicar}
          />
        </SecaoDeFormulario>

        {eOng ? (
          <>
            <SecaoDeFormulario titulo="Organização" texto="Nome e descrição vão para a página pública.">
              <TextInput label="Nome da organização" placeholder="Instituto Verde Mar"
                autoComplete="organization" {...form.getInputProps("nome_organizacao")} />
              <Textarea label="O que a organização faz" minRows={3} autosize
                placeholder="Em duas ou três frases, para quem vai se inscrever…"
                {...form.getInputProps("descricao")} />
              <TextInput label="CNPJ" placeholder="00.000.000/0001-00" maw={260}
                inputMode="numeric" autoComplete="off" {...form.getInputProps("cnpj")} />
            </SecaoDeFormulario>
            <SecaoDeFormulario titulo="Contato e endereço"
                   texto="Telefone, CNPJ e endereço não aparecem na página pública.">
              <TextInput label="Telefone" placeholder="(85) 99999-9999" type="tel"
                autoComplete="tel" maw={260} {...form.getInputProps("telefone")} />
              <TextInput label="Endereço" placeholder="Rua, número, bairro"
                autoComplete="street-address" {...form.getInputProps("endereco")} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Cidade" autoComplete="address-level2"
                  {...form.getInputProps("cidade")} />
                <TextInput label="Estado" autoComplete="address-level1"
                  {...form.getInputProps("estado")} />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Site" placeholder="https://…" type="url"
                  autoComplete="url" {...form.getInputProps("site")} />
                <TextInput label="Instagram" placeholder="@suaong" autoComplete="off"
                  spellCheck={false} {...form.getInputProps("instagram")} />
              </SimpleGrid>
            </SecaoDeFormulario>
          </>
        ) : (
          <>
            <SecaoDeFormulario titulo="Para o certificado"
                   texto="Obrigatórios antes da primeira inscrição. Confira a grafia do nome: ele sai igual no certificado.">
              <TextInput label="Nome completo" withAsterisk autoComplete="name"
                placeholder="Como no seu documento"
                {...form.getInputProps("nome_completo")} />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Instituição" placeholder="UniC" withAsterisk
                  autoComplete="organization" {...form.getInputProps("instituicao")} />
                <TextInput label="Curso" placeholder="Sistemas de Informação" withAsterisk
                  {...form.getInputProps("curso")} />
              </SimpleGrid>
            </SecaoDeFormulario>
            <SecaoDeFormulario titulo="Contato" texto="Só a ONG das atividades em que você se inscreve vê.">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Telefone" placeholder="(85) 99999-9999" type="tel"
                  autoComplete="tel" {...form.getInputProps("telefone")} />
                <TextInput label="LinkedIn" placeholder="linkedin.com/in/voce" type="url"
                  autoComplete="url" {...form.getInputProps("linkedin")} />
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <TextInput label="Cidade" autoComplete="address-level2"
                  {...form.getInputProps("cidade")} />
                <TextInput label="Estado" autoComplete="address-level1"
                  {...form.getInputProps("estado")} />
                <TextInput label="Bairro" autoComplete="off"
                  {...form.getInputProps("bairro")} />
              </SimpleGrid>
            </SecaoDeFormulario>
            <SecaoDeFormulario titulo="Sobre você" texto="Opcional. Ajuda a ONG a conhecer quem vai chegar.">
              <Textarea label="Sobre mim" minRows={3} autosize
                placeholder="Curso, interesses, o que gostaria de fazer…"
                {...form.getInputProps("sobre_mim")} />
            </SecaoDeFormulario>
          </>
        )}

        <Group justify="flex-end" gap="sm" pt="lg"
               style={{ borderTop: "1px solid var(--mh-linha)" }}>
          {form.isDirty() && (
            <Text size="sm" c="dimmed">Alterações não salvas</Text>
          )}
          <Button type="submit" loading={salvando} disabled={!form.isDirty()}>
            Salvar alterações
          </Button>
        </Group>
      </form>
    </>
  );
}
