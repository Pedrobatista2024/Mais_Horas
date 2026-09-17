import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconCalendarEvent, IconCertificate, IconCircleCheck,
  IconCircleX, IconListSearch, IconQrcode, IconUsers,
} from "@tabler/icons-react";

import { SITUACOES } from "../../components/atividade/situacoes";
import Loading from "../../components/ui/Loading";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

const COR_DA_GRAVIDADE = { critica: "red", alta: "orange", media: "yellow", baixa: "gray" };

function Numero({ icone: Icone, rotulo, valor, detalhe, cor = "brand" }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text size="sm" c="dimmed">{rotulo}</Text>
          <Title order={2} lh={1.2}>{valor}</Title>
          {detalhe && <Text size="xs" c="dimmed" mt={4}>{detalhe}</Text>}
        </div>
        <ThemeIcon size={40} radius="md" variant="light" color={cor}>
          <Icone size={22} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function Saude({ ok, rotulo }) {
  return (
    <Group gap={6} wrap="nowrap">
      {ok ? <IconCircleCheck size={18} color="var(--mantine-color-brand-6)" />
          : <IconCircleX size={18} color="var(--mantine-color-red-6)" />}
      <Text size="sm">{rotulo}</Text>
    </Group>
  );
}

/** A1 — Visão geral do console. */
export default function VisaoGeral() {
  const navegar = useNavigate();
  const [dados, setDados] = useState(null);

  useEffect(() => {
    let ativo = true;
    api.get("/admin/visao-geral")
      .then(({ data }) => { if (ativo) setDados(data); })
      .catch((erro) => notifyError(mensagemDoErro(erro, "Não foi possível carregar o painel")));
    return () => { ativo = false; };
  }, []);

  if (!dados) return <Loading label="Carregando painel..." />;

  const { contas, atividades, certificados, saude, alertas } = dados;

  return (
    <Stack gap="lg">
      <PageHeader
        eyebrow="Administração"
        title="Visão geral"
        subtitle="O estado da plataforma e o que precisa de atenção."
        action={
          <Button variant="light" leftSection={<IconListSearch size={16} />}
                  onClick={() => navegar("/admin/auditoria")}>
            Ver auditoria
          </Button>
        }
      />

      {alertas.length === 0 ? (
        <Alert color="brand" variant="light" icon={<IconCircleCheck size={18} />}>
          Nada exige atenção agora.
        </Alert>
      ) : (
        <Stack gap="xs">
          {alertas.map((alerta) => (
            <Alert key={alerta.tipo} color={COR_DA_GRAVIDADE[alerta.gravidade]}
                   variant="light" icon={<IconAlertTriangle size={18} />}>
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Text size="sm">{alerta.mensagem}</Text>
                <Button size="compact-xs" variant="white"
                        onClick={() => navegar(alerta.link)}>
                  Investigar
                </Button>
              </Group>
            </Alert>
          ))}
        </Stack>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }}>
        <Numero icone={IconUsers} rotulo="Contas" valor={contas.total}
                detalhe={`${contas.porPapel.estudante} alunos · ${contas.porPapel.ong} ONGs · ${contas.novasNaSemana} novas na semana`} />
        <Numero icone={IconCertificate} rotulo="Certificados" valor={certificados.emitidos}
                detalhe={`${certificados.revogados} revogado(s)`} cor="navy" />
        <Numero icone={IconQrcode} rotulo="Check-ins em 24 h"
                valor={dados.checkinsUltimas24h} cor="clay" />
        <Numero icone={IconUsers} rotulo="Contas suspensas" valor={contas.suspensas}
                cor={contas.suspensas ? "red" : "gray"} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder radius="md" p="lg">
          <Group gap="xs" mb="sm">
            <IconCalendarEvent size={18} />
            <Text fw={700}>Atividades por situação</Text>
          </Group>
          <Stack gap={6}>
            {Object.entries(atividades).map(([situacao, total]) => (
              <Group key={situacao} justify="space-between">
                <Badge variant="light" color={SITUACOES[situacao]?.cor ?? "gray"}>
                  {SITUACOES[situacao]?.rotulo ?? situacao}
                </Badge>
                <Text fw={600}>{total}</Text>
              </Group>
            ))}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Text fw={700} mb="sm">Saúde</Text>
          <Stack gap="xs">
            <Saude ok={saude.banco} rotulo="Banco de dados respondendo" />
            <Saude ok={saude.chaveDeAssinatura}
                   rotulo={saude.chaveDeAssinatura
                     ? "Chave de assinatura configurada"
                     : "Sem chave de assinatura — certificados não podem ser emitidos"} />
            <Saude ok={saude.email !== "console"}
                   rotulo={saude.email === "console"
                     ? "E-mail em modo console (nada é enviado de verdade)"
                     : `E-mail: ${saude.email}`} />
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
