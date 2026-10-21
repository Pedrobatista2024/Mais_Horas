import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Anchor, Box, Badge, Button, Center, Group, Modal, Pagination, PasswordInput, Select,
  SimpleGrid, Stack, Table, Text, TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch, IconShieldPlus, IconUsers } from "@tabler/icons-react";

import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { useListagem } from "../../hooks/useListagem";
import { api, mensagemDoErro } from "../../services/api";
import { formatRelativo } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";
import { COR_DO_PAPEL, ROTULO_DO_PAPEL } from "./rotulos";


function CriarAdmin({ aberto, aoFechar, aoCriar }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [enviando, setEnviando] = useState(false);

  function fechar() {
    setNome(""); setEmail(""); setSenhaAtual("");
    aoFechar();
  }

  async function criar(evento) {
    evento.preventDefault();
    setEnviando(true);
    try {
      const { data } = await api.post("/admin/administradores",
                                      { nome, email, senhaAtual });
      notifySuccess(`Conta criada. ${data.email} vai receber o link para definir a senha.`);
      fechar();
      aoCriar();
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível criar o administrador"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal opened={aberto} onClose={fechar} title="Criar administrador" centered>
      <form onSubmit={criar}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            A pessoa recebe um link para definir a própria senha — ninguém escolhe a
            senha de outra conta.
          </Text>
          <TextInput label="Nome" required value={nome}
                     onChange={(e) => setNome(e.currentTarget.value)} />
          <TextInput label="E-mail" type="email" required value={email}
                     onChange={(e) => setEmail(e.currentTarget.value)} />
          <PasswordInput label="Sua senha" required
                         description="Confirma que é você quem está criando a conta"
                         value={senhaAtual}
                         onChange={(e) => setSenhaAtual(e.currentTarget.value)} />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={fechar}>Voltar</Button>
            <Button type="submit" loading={enviando}>Criar administrador</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

/** A3 — Usuários. */
export default function Usuarios() {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [papel, setPapel] = useState(null);
  const [situacao, setSituacao] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);

  const [buscaAdiada] = useDebouncedValue(busca, 350);
  const params = useMemo(() => ({
    busca: buscaAdiada.trim() || undefined, papel: papel ?? undefined,
    situacao: situacao ?? undefined, pagina, tamanho: 20,
  }), [buscaAdiada, papel, situacao, pagina]);
  const { dados, carregando, recarregar } = useListagem("/admin/usuarios", params);

  return (
    <Stack gap="lg">
      <PageHeader
        title="Usuários"
        subtitle="Todas as contas da plataforma."
        action={
          <Button leftSection={<IconShieldPlus size={16} />}
                  onClick={() => setCriando(true)}>
            Criar administrador
          </Button>
        }
      />

      <Box>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Buscar" placeholder="Nome ou e-mail"
                     leftSection={<IconSearch size={16} />} value={busca}
                     onChange={(e) => { setBusca(e.currentTarget.value); setPagina(1); }} />
          <Select label="Papel" placeholder="Todos" clearable value={papel}
                  onChange={(v) => { setPapel(v); setPagina(1); }}
                  data={[{ value: "estudante", label: "Aluno" },
                         { value: "ong", label: "ONG" },
                         { value: "superadmin", label: "Admin" }]} />
          <Select label="Situação" placeholder="Todas" clearable value={situacao}
                  onChange={(v) => { setSituacao(v); setPagina(1); }}
                  data={[{ value: "ativa", label: "Ativa" },
                         { value: "suspensa", label: "Suspensa" }]} />
        </SimpleGrid>
      </Box>

      {carregando ? (
        <Loading label="Carregando contas…" />
      ) : dados.itens.length === 0 ? (
        <EmptyState icon={IconUsers} title="Nenhuma conta encontrada"
                    description="Ajuste a busca ou os filtros." />
      ) : (
        <Box className="mh-bloco" style={{ overflow: "hidden" }}>
          <Table.ScrollContainer minWidth={0}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th visibleFrom="sm">Papel</Table.Th>
                  <Table.Th visibleFrom="sm">Situação</Table.Th>
                  <Table.Th visibleFrom="sm">Último acesso</Table.Th>
                  <Table.Th visibleFrom="md">Criada</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dados.itens.map((u) => (
                  <Table.Tr key={u.id} style={{ cursor: "pointer" }}
                            onClick={() => navegar(`/admin/usuarios/${u.id}`)}>
                    <Table.Td>
                      <Anchor component={Link} to={`/admin/usuarios/${u.id}`} size="sm"
                              fw={600} c="inherit" onClick={(e) => e.stopPropagation()}>
                        {u.nome}
                      </Anchor>
                      <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                        {u.email}
                      </Text>
                      <Group gap={6} mt={6} hiddenFrom="sm">
                        <Badge color={COR_DO_PAPEL[u.papel]}>{ROTULO_DO_PAPEL[u.papel]}</Badge>
                        <Badge variant="dot" color={u.situacao === "ativa" ? "green" : "red"}>
                          {u.situacao === "ativa" ? "Ativa" : "Suspensa"}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td visibleFrom="sm">
                      <Badge color={COR_DO_PAPEL[u.papel]}>
                        {ROTULO_DO_PAPEL[u.papel]}
                      </Badge>
                    </Table.Td>
                    <Table.Td visibleFrom="sm">
                      <Badge variant="dot" color={u.situacao === "ativa" ? "green" : "red"}>
                        {u.situacao === "ativa" ? "Ativa" : "Suspensa"}
                      </Badge>
                    </Table.Td>
                    <Table.Td visibleFrom="sm">
                      <Text size="sm">
                        {u.ultimoAcesso ? formatRelativo(u.ultimoAcesso) : "Nunca entrou"}
                      </Text>
                    </Table.Td>
                    <Table.Td visibleFrom="md">
                      <Text size="sm">{new Date(u.criadoEm).toLocaleDateString("pt-BR")}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Box>
      )}

      {dados.paginas > 1 && (
        <Center>
          <Pagination total={dados.paginas} value={pagina} onChange={setPagina} />
        </Center>
      )}

      <CriarAdmin aberto={criando} aoFechar={() => setCriando(false)}
                  aoCriar={recarregar} />
    </Stack>
  );
}
