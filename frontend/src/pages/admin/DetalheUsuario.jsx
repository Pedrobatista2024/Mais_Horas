import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title,
} from "@mantine/core";
import {
  IconArrowLeft, IconKey, IconListSearch, IconLogout, IconUserCheck, IconUserOff,
} from "@tabler/icons-react";

import ConfirmarAcao from "../../components/ui/ConfirmarAcao";
import EmptyState from "../../components/ui/EmptyState";
import Loading from "../../components/ui/Loading";
import { api, mensagemDoErro } from "../../services/api";
import { formatRelativo } from "../../utils/format";
import { notifyError, notifySuccess } from "../../utils/notify";
import { COR_DO_PAPEL, ROTULO_DO_PAPEL } from "./rotulos";

const ROTULOS_DO_PERFIL = {
  nomeCompleto: "Nome completo", instituicao: "Instituição", curso: "Curso",
  telefone: "Telefone", cidade: "Cidade", nomeOrganizacao: "Organização",
  cnpj: "CNPJ", verificada: "Verificada",
};

function Dado({ rotulo, valor }) {
  return (
    <div>
      <Text size="xs" c="dimmed">{rotulo}</Text>
      <Text size="sm" fw={600}>{valor === true ? "sim" : valor === false ? "não"
        : valor || "—"}</Text>
    </div>
  );
}

/**
 * A4 — Detalhe do usuário.
 *
 * Não há "definir senha" nem "trocar e-mail": qualquer um dos dois deixaria o
 * admin entrar como a pessoa, e a trilha passaria a mostrar as ações dele como
 * se fossem dela (D12).
 */
export default function DetalheUsuario() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState(false);
  const [confirmando, setConfirmando] = useState(null);

  const carregar = useCallback(() => {
    api.get(`/admin/usuarios/${id}`)
      .then(({ data }) => setUsuario(data))
      .catch((e) => {
        setErro(true);
        notifyError(mensagemDoErro(e, "Não foi possível carregar a conta"));
      });
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function executar(acao, motivo) {
    try {
      if (acao === "senha") {
        const { data } = await api.post(`/admin/usuarios/${id}/redefinir-senha`);
        notifySuccess(`Link enviado para ${data.enviadoPara}.`);
      } else if (acao === "sessoes") {
        await api.post(`/admin/usuarios/${id}/encerrar-sessoes`);
        notifySuccess("Sessões encerradas. A pessoa vai precisar entrar de novo.");
      } else if (acao === "suspender") {
        const { data } = await api.post(`/admin/usuarios/${id}/suspender`, { motivo });
        notifySuccess(data.atividadesCanceladas
          ? `Conta suspensa. ${data.atividadesCanceladas} atividade(s) futura(s) cancelada(s).`
          : "Conta suspensa.");
      } else if (acao === "reativar") {
        await api.post(`/admin/usuarios/${id}/reativar`);
        notifySuccess("Conta reativada.");
      }
      carregar();
    } catch (e) {
      notifyError(mensagemDoErro(e, "Não foi possível concluir a ação"));
    }
  }

  if (erro) {
    return <EmptyState title="Conta não encontrada"
                       action={{ label: "Voltar", onClick: () => navegar("/admin/usuarios") }} />;
  }
  if (!usuario) return <Loading label="Carregando conta..." />;

  const suspensa = usuario.situacao === "suspensa";
  const eAdmin = usuario.papel === "superadmin";

  const CONFIRMACOES = {
    senha: {
      titulo: "Redefinir senha",
      mensagem: `Um link de redefinição será enviado para ${usuario.email}. Você não vê nem escolhe a nova senha.${eAdmin ? " O alvo é um administrador — a ação fica registrada com destaque." : ""}`,
      rotulo: "Enviar link", cor: "brand",
    },
    sessoes: {
      titulo: "Encerrar sessões",
      mensagem: "Todos os acessos abertos desta conta serão derrubados. Use em caso de suspeita de conta comprometida.",
      rotulo: "Encerrar sessões",
    },
    suspender: {
      titulo: "Suspender conta",
      mensagem: usuario.papel === "ong"
        ? "A organização perde o acesso. As atividades que ainda não começaram são canceladas e os inscritos, avisados. Reativar depois não as reabre. Nada é apagado."
        : "A pessoa perde o acesso e as sessões abertas caem. Nada é apagado: histórico e certificados permanecem.",
      rotulo: "Suspender", motivo: true,
    },
    reativar: {
      titulo: "Reativar conta", mensagem: "A pessoa volta a poder entrar.",
      rotulo: "Reativar", cor: "brand",
    },
  };
  const atual = confirmando ? CONFIRMACOES[confirmando] : null;

  return (
    <Stack gap="lg" maw={960}>
      <Button variant="subtle" size="compact-sm" w="fit-content"
              leftSection={<IconArrowLeft size={15} />}
              onClick={() => navegar("/admin/usuarios")}>
        Usuários
      </Button>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Badge variant="light" color={COR_DO_PAPEL[usuario.papel]}>
              {ROTULO_DO_PAPEL[usuario.papel]}
            </Badge>
            <Badge variant="dot" color={suspensa ? "red" : "brand"}>{usuario.situacao}</Badge>
          </Group>
          <Title order={1} fz={{ base: 24, sm: 30 }}>{usuario.nome}</Title>
          <Text c="dimmed">{usuario.email}</Text>
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Button variant="light" leftSection={<IconKey size={16} />}
                  disabled={suspensa} onClick={() => setConfirmando("senha")}>
            Redefinir senha
          </Button>
          <Button variant="light" leftSection={<IconLogout size={16} />}
                  disabled={usuario.sessoesAtivas.length === 0}
                  onClick={() => setConfirmando("sessoes")}>
            Encerrar sessões
          </Button>
          {suspensa ? (
            <Button color="brand" leftSection={<IconUserCheck size={16} />}
                    onClick={() => setConfirmando("reativar")}>
              Reativar
            </Button>
          ) : (
            <Button color="red" variant="light" leftSection={<IconUserOff size={16} />}
                    onClick={() => setConfirmando("suspender")}>
              Suspender
            </Button>
          )}
        </Group>
      </Group>

      {suspensa && (
        <Alert color="red" variant="light" title="Conta suspensa">
          Desde {new Date(usuario.suspensoEm).toLocaleString("pt-BR")}. Motivo:{" "}
          {usuario.motivoSuspensao}
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="lg">
          <Text fw={700} mb="sm">Perfil</Text>
          {usuario.perfil ? (
            <SimpleGrid cols={2} spacing="sm">
              {Object.entries(usuario.perfil).map(([chave, valor]) => (
                <Dado key={chave} rotulo={ROTULOS_DO_PERFIL[chave] ?? chave} valor={valor} />
              ))}
            </SimpleGrid>
          ) : <Text size="sm" c="dimmed">Perfil não preenchido.</Text>}
        </Card>

        <Card withBorder radius="md" p="lg">
          <Text fw={700} mb="sm">Números</Text>
          <SimpleGrid cols={2} spacing="sm">
            <Dado rotulo="Criada em" valor={new Date(usuario.criadoEm).toLocaleDateString("pt-BR")} />
            <Dado rotulo="Último acesso"
                  valor={usuario.ultimoAcesso ? formatRelativo(usuario.ultimoAcesso) : "nunca"} />
            <Dado rotulo="Inscrições" valor={String(usuario.contagens.inscricoes)} />
            <Dado rotulo="Certificados" valor={String(usuario.contagens.certificados)} />
            {usuario.papel === "ong" && (
              <Dado rotulo="Atividades" valor={String(usuario.contagens.atividades)} />
            )}
          </SimpleGrid>
          <Button variant="subtle" size="compact-sm" mt="md"
                  leftSection={<IconListSearch size={15} />}
                  onClick={() => navegar(`/admin/auditoria?alvoId=${usuario.id}`)}>
            Ver auditoria desta conta
          </Button>
        </Card>
      </SimpleGrid>

      <Card withBorder radius="md" p={0}>
        <Text fw={700} p="lg" pb="xs">Sessões ativas</Text>
        {usuario.sessoesAtivas.length === 0 ? (
          <Text size="sm" c="dimmed" px="lg" pb="lg">Nenhuma sessão aberta.</Text>
        ) : (
          <Table.ScrollContainer minWidth={560}>
            <Table verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Aberta</Table.Th>
                  <Table.Th>IP</Table.Th>
                  <Table.Th>Dispositivo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {usuario.sessoesAtivas.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td><Text size="sm">{formatRelativo(s.abertaEm)}</Text></Table.Td>
                    <Table.Td><Text size="sm">{s.ip ?? "—"}</Text></Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" lineClamp={1}>{s.dispositivo ?? "—"}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>

      {atual && (
        <ConfirmarAcao
          aberto
          aoFechar={() => setConfirmando(null)}
          titulo={atual.titulo}
          mensagem={atual.mensagem}
          rotuloConfirmar={atual.rotulo}
          cor={atual.cor ?? "red"}
          motivoObrigatorio={Boolean(atual.motivo)}
          descricaoMotivo="Fica registrado na auditoria."
          aoConfirmar={(motivo) => executar(confirmando, motivo)}
        />
      )}
    </Stack>
  );
}
