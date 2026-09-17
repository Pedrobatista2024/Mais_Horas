import { Link } from "react-router-dom";
import {
  Badge, Box, Button, Code, Container, Group, List, Paper, SimpleGrid, Stack, Text,
  ThemeIcon, Timeline, Title,
} from "@mantine/core";
import {
  IconAlertTriangle, IconBan, IconCalendarEvent, IconCertificate, IconCircleCheck,
  IconFileSearch, IconHelpCircle, IconQrcode, IconSearch, IconShieldCheck, IconUserCheck,
} from "@tabler/icons-react";

import ChamadaFinal from "../../components/portal/ChamadaFinal";
import Secao from "../../components/portal/Secao";
import { useAuth } from "../../context/AuthContext";
import { useConsultaPublica } from "../../hooks/useConsultaPublica";
import { cadastroComo } from "../../components/portal/navegacao";

const JORNADA = [
  {
    icone: IconCalendarEvent, cor: "navy", titulo: "A ONG publica a atividade",
    texto: "Começa como rascunho, com data, horário, local, carga horária e limite de vagas. Publicada, entra na vitrine. Depois que alguém se inscreve, só o número de vagas pode mudar.",
  },
  {
    icone: IconSearch, cor: "brand", titulo: "O estudante se inscreve",
    texto: "Com o perfil completo (nome, instituição e curso), ele se inscreve. A ONG decide se confirma na hora ou avalia cada pedido. Cada estudante pode ter até 5 inscrições ativas.",
  },
  {
    icone: IconQrcode, cor: "clay", titulo: "No dia, check-in pelo QR",
    texto: "A ONG exibe um QR que muda a cada 30 segundos. O estudante escaneia com o celular e o horário fica registrado. Quem ficar sem sinal pode ser registrado pela ONG manualmente — e fica marcado como manual.",
  },
  {
    icone: IconUserCheck, cor: "navy", titulo: "A ONG confirma a presença",
    texto: "O check-in é evidência, não decisão: quem marca presente ou ausente é a organização. A atividade só é finalizada quando ninguém fica sem decisão.",
  },
  {
    icone: IconCertificate, cor: "brand", titulo: "O certificado sai assinado",
    texto: "Ao finalizar, cada presente recebe o certificado na hora, em PDF, com código único e QR Code.",
  },
  {
    icone: IconShieldCheck, cor: "clay", titulo: "Qualquer pessoa confere",
    texto: "A coordenação escaneia o QR ou digita o código e vê os dados do certificado, sem precisar de conta.",
  },
];

const DESFECHOS = [
  { icone: IconCircleCheck, cor: "brand", titulo: "Válido",
    texto: "A assinatura confere com todos os dados exibidos." },
  { icone: IconBan, cor: "orange", titulo: "Revogado",
    texto: "Foi emitido, mas a administração o invalidou — com data e motivo." },
  { icone: IconAlertTriangle, cor: "red", titulo: "Adulterado",
    texto: "Algum dado não bate com a assinatura. A tentativa fica registrada." },
  { icone: IconHelpCircle, cor: "gray", titulo: "Não encontrado",
    texto: "Nenhum certificado com esse código foi emitido aqui." },
];

/**
 * T2 — Como funciona.
 *
 * A página que sustenta a conversa técnica sem exigir login: a jornada inteira
 * e por que foto de QR e certificado editado não passam.
 */
export default function ComoFunciona() {
  const { autenticado } = useAuth();
  const resumo = useConsultaPublica("/portal/resumo");
  const exemplo = resumo?.codigoDemonstracao;

  return (
    <>
      <Box className="mh-hero">
        <Container size="xl" py={{ base: 48, md: 72 }}>
          <Stack gap="lg" maw={720}>
            <Badge size="lg" radius="sm" color="clay" variant="filled" w="fit-content">
              Como funciona
            </Badge>
            <Title className="mh-display" c="white" fz={{ base: 34, sm: 46 }}>
              Do anúncio ao certificado conferido
            </Title>
            <Text c="rgba(255,255,255,0.9)" fz={{ base: "md", md: "lg" }}>
              Cada etapa deixa rastro. É isso que permite a uma instituição aceitar o
              certificado sem precisar ligar para a ONG.
            </Text>
            <Group gap="md">
              {!autenticado && (
                <Button size="lg" color="clay" component={Link} to={cadastroComo("estudante")}>
                  Criar conta
                </Button>
              )}
              <Button size="lg" variant="white" color="dark" component={Link}
                      to={exemplo ? `/verificar/${exemplo}` : "/verificar"}
                      leftSection={<IconFileSearch size={18} />}>
                {exemplo ? "Ver uma verificação de exemplo" : "Verificar um certificado"}
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Secao eyebrow="A jornada" titulo="Seis etapas, do começo ao fim">
        <Timeline active={JORNADA.length} bulletSize={40} lineWidth={2} maw={760} mx="auto">
          {JORNADA.map(({ icone: Icone, cor, titulo, texto }) => (
            <Timeline.Item key={titulo} color={cor}
                           bullet={<Icone size={20} />}
                           title={<Text fw={800} fz="lg">{titulo}</Text>}>
              <Text c="dimmed" size="sm" mt={4} mb="lg">{texto}</Text>
            </Timeline.Item>
          ))}
        </Timeline>
      </Secao>

      <Secao alternada eyebrow="Presença" titulo="Por que foto do QR não funciona">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
          <Stack gap="sm">
            <Text>
              O QR exibido pela ONG é um código que <b>muda a cada 30 segundos</b>. Ele
              leva a identificação da atividade, a janela de tempo e uma assinatura
              calculada com um segredo que só o servidor conhece.
            </Text>
            <Text>
              Quando o estudante escaneia, o servidor refaz a conta. Se a janela já
              passou — com uma folga de 10 segundos para quem escaneou no último
              instante —, o código é recusado. Uma foto repassada no grupo chega
              velha demais.
            </Text>
            <Text c="dimmed" size="sm">
              Nenhum código é guardado: validar é recalcular. Não existe lista de
              códigos para vazar.
            </Text>
          </Stack>
          <Paper withBorder radius="lg" p="lg">
            <Text fw={800} mb="sm">O que o check-in registra</Text>
            <List spacing="xs" size="sm" icon={
              <ThemeIcon size={20} radius="xl" color="brand"><IconCircleCheck size={13} /></ThemeIcon>
            }>
              <List.Item>Quem fez e em que horário</List.Item>
              <List.Item>Se veio do QR ou foi registrado pela ONG</List.Item>
              <List.Item>Quem registrou, no caso manual</List.Item>
            </List>
            <Text size="sm" c="dimmed" mt="md">
              A presença final continua sendo decisão da ONG. Se ela divergir do
              check-in, a diferença fica visível para auditoria.
            </Text>
          </Paper>
        </SimpleGrid>
      </Secao>

      <Secao eyebrow="Certificado" titulo="Assinado, não só impresso">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" mb="xl">
          <Stack gap="sm">
            <Text>
              Na emissão, o sistema assina com uma chave privada (<b>Ed25519</b>) o
              conjunto de dados que a verificação mostra: código, nome do estudante,
              organização, atividade, horas, data e momento da emissão.
            </Text>
            <Text>
              Na verificação, a assinatura é conferida contra esses mesmos dados. Mudar
              uma letra do nome ou uma hora a mais no banco já é suficiente para o
              certificado aparecer como adulterado.
            </Text>
          </Stack>
          <Paper withBorder radius="lg" p="lg">
            <Text fw={800} mb="xs">Na prática</Text>
            <Text size="sm" c="dimmed">
              Cada certificado tem um código de 16 caracteres, como{" "}
              <Code>a1b2c3d4e5f60718</Code>, impresso junto com o QR. O endereço de
              verificação é público e não exige login.
            </Text>
          </Paper>
        </SimpleGrid>

        <Text fw={800} ta="center" mb="md">O que a verificação pode responder</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {DESFECHOS.map(({ icone: Icone, cor, titulo, texto }) => (
            <Paper key={titulo} withBorder radius="lg" p="lg" h="100%">
              <Group gap="sm" mb={6} wrap="nowrap">
                <ThemeIcon size={34} radius="md" variant="light" color={cor}>
                  <Icone size={20} />
                </ThemeIcon>
                <Text fw={800}>{titulo}</Text>
              </Group>
              <Text size="sm" c="dimmed">{texto}</Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Secao>

      <ChamadaFinal />
    </>
  );
}
