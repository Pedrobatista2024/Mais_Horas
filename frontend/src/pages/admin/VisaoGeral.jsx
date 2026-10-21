import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Group, SimpleGrid, Stack, Text, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconCircleCheck, IconCircleX, IconListSearch,
} from "@tabler/icons-react";

import SituacaoBadge from "../../components/atividade/SituacaoBadge";
import Loading from "../../components/ui/Loading";
import Numeros from "../../components/ui/Numeros";
import PageHeader from "../../components/ui/PageHeader";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

const COR_DA_GRAVIDADE = { critica: "red", alta: "orange", media: "yellow", baixa: "gray" };

function Saude({ ok, rotulo }) {
  return (
    <Group gap={8} wrap="nowrap" className="mh-linha">
      {ok ? <IconCircleCheck size={18} color="var(--mantine-color-green-7)" aria-label="ok" />
          : <IconCircleX size={18} color="var(--mantine-color-red-7)" aria-label="problema" />}
      <Text size="sm">{rotulo}</Text>
    </Group>
  );
}

/** A1 — Visão geral do console: o que precisa de atenção primeiro, números depois. */
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

  if (!dados) return <Loading label="Carregando painel…" />;

  const { contas, atividades, certificados, saude, alertas } = dados;

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="O estado da plataforma e o que precisa de atenção."
        action={
          <Button variant="default" leftSection={<IconListSearch size={16} />}
                  component={Link} to="/admin/auditoria">
            Ver auditoria
          </Button>
        }
      />

      <Stack gap={36}>
        {alertas.length === 0 ? (
          <Alert color="green" icon={<IconCircleCheck size={18} />}>
            Nada exige atenção agora.
          </Alert>
        ) : (
          <Stack gap="xs">
            {alertas.map((alerta) => (
              <Alert key={alerta.tipo} color={COR_DA_GRAVIDADE[alerta.gravidade]}
                     icon={<IconAlertTriangle size={18} />}>
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Text size="sm">{alerta.mensagem}</Text>
                  <Button size="xs" variant="default" onClick={() => navegar(alerta.link)}>
                    Ver detalhes
                  </Button>
                </Group>
              </Alert>
            ))}
          </Stack>
        )}

        <Numeros itens={[
          { rotulo: "Contas", valor: contas.total,
            detalhe: `${contas.porPapel.estudante} alunos, ${contas.porPapel.ong} ONGs; ${contas.novasNaSemana} novas na semana` },
          { rotulo: "Certificados", valor: certificados.emitidos,
            detalhe: certificados.revogados === 1 ? "1 revogado"
              : `${certificados.revogados} revogados` },
          { rotulo: "Check-ins em 24 h", valor: dados.checkinsUltimas24h },
          { rotulo: "Contas suspensas", valor: contas.suspensas },
        ]} />

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={40} verticalSpacing={36}>
          <Box component="section">
            <Title order={2} fz="lg" mb="sm">Atividades por situação</Title>
            <Box className="mh-lista">
              {Object.entries(atividades).map(([situacao, total]) => (
                <Group key={situacao} className="mh-linha" justify="space-between">
                  <SituacaoBadge situacao={situacao} />
                  <Text fw={600} className="mh-num">{total}</Text>
                </Group>
              ))}
            </Box>
          </Box>

          <Box component="section">
            <Title order={2} fz="lg" mb="sm">Saúde do sistema</Title>
            <Box className="mh-lista">
              <Saude ok={saude.banco} rotulo="Banco de dados respondendo" />
              <Saude ok={saude.chaveDeAssinatura}
                     rotulo={saude.chaveDeAssinatura
                       ? "Chave de assinatura configurada"
                       : "Sem chave de assinatura: nenhum certificado pode ser emitido"} />
              <Saude ok={saude.email !== "console"}
                     rotulo={saude.email === "console"
                       ? "E-mail em modo console: nada é enviado de verdade"
                       : `E-mail: ${saude.email}`} />
            </Box>
          </Box>
        </SimpleGrid>
      </Stack>
    </>
  );
}
