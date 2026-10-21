import { Link } from "react-router-dom";
import {
  Anchor, Box, Button, Container, Grid, Group, SimpleGrid, Stack, Text, Title,
} from "@mantine/core";

import CartaoOng from "../../components/portal/CartaoOng";
import ChamadaFinal from "../../components/portal/ChamadaFinal";
import ExemplarCertificado from "../../components/portal/ExemplarCertificado";
import NumerosDeImpacto from "../../components/portal/NumerosDeImpacto";
import Passo from "../../components/portal/Passo";
import Secao from "../../components/portal/Secao";
import { numerosVisiveis } from "../../components/portal/impacto";
import { LARGURA_DO_PORTAL } from "../../components/portal/navegacao";
import DataBloco from "../../components/ui/DataBloco";
import Horas from "../../components/ui/Horas";
import { useConsultaPublica } from "../../hooks/useConsultaPublica";
import { useTitulo } from "../../hooks/useTitulo";

/** As próximas vagas, no lugar da foto de banco de imagens que ficava no topo. */
function ProximasVagas({ vagas, total }) {
  return (
    <Box bg="white" c="var(--mh-tinta)" style={{ borderRadius: 8 }}>
      <Group justify="space-between" px="md" pt="md" pb="xs">
        <Text fw={600}>Próximas vagas</Text>
        <Text size="sm" c="dimmed" className="mh-num">
          {total} {total === 1 ? "aberta" : "abertas"}
        </Text>
      </Group>
      <Box>
        {vagas.map((a) => (
          <Group key={a.id} className="mh-linha" data-clicavel="true" gap="md" wrap="nowrap"
                 pos="relative">
            <DataBloco data={a.data} />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} lineClamp={1} component={Link} to={`/vagas/${a.id}`}
                    className="mh-link-titulo">
                {a.titulo}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={1}>{a.ong?.nome}</Text>
            </Box>
            <Horas valor={a.cargaHoraria} />
          </Group>
        ))}
      </Box>
      <Box px="md" py="sm" style={{ borderTop: "1px solid var(--mh-linha)" }}>
        <Anchor component={Link} to="/vagas" size="sm" fw={500}>
          Ver todas as vagas
        </Anchor>
      </Box>
    </Box>
  );
}

/**
 * T1 — Início do portal.
 *
 * O topo mostra as vagas de verdade, vindas da API, e não uma foto genérica:
 * para o estudante, é a resposta para "tem onde fazer horas?". Mais abaixo, o
 * certificado de exemplo mostra o que o projeto tem de diferente.
 *
 * Todo número desta página vem da API. Sem movimento na plataforma, as seções
 * de vagas, parceiras e números simplesmente não aparecem.
 */
export default function Inicio() {
  useTitulo("Vagas de voluntariado para horas de extensão");
  const resumo = useConsultaPublica("/portal/resumo");
  const vagas = useConsultaPublica("/atividades?tamanho=4");
  const parceiras = useConsultaPublica("/portal/ongs?tamanho=6");

  const temVagas = vagas?.itens?.length > 0;

  return (
    <>
      <Box className="mh-hero">
        <Container size={LARGURA_DO_PORTAL} py={{ base: 48, md: 88 }}>
          <Grid gutter={{ base: 40, md: 64 }} align="center">
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack gap="lg">
                <Title order={1} className="mh-display" c="white"
                       fz={{ base: 34, sm: 44, md: 52 }} maw={640}>
                  Faça suas horas de extensão onde alguém precisa de ajuda
                </Title>
                <Text c="rgba(255,255,255,0.86)" fz={{ base: "md", md: "lg" }} maw={560}>
                  As ONGs publicam as vagas e você se inscreve. No dia, a presença é
                  registrada por QR Code, e o certificado sai assinado. A coordenação do
                  curso confere pelo próprio QR.
                </Text>
                <Group gap="sm" mt="xs">
                  <Button size="md" variant="white" component={Link} to="/vagas">
                    Ver vagas abertas
                  </Button>
                  <Button size="md" variant="outline" color="#ffffff" component={Link}
                          to="/para-ongs">
                    Sou de uma ONG
                  </Button>
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              {temVagas
                ? <ProximasVagas vagas={vagas.itens} total={vagas.total} />
                : <ExemplarCertificado />}
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      <Secao titulo="Da vaga ao certificado"
             subtitulo="Quatro passos, sem planilha, lista de papel ou declaração que qualquer um edita."
             acao={<Anchor component={Link} to="/como-funciona" fw={500}>
                     Ver o passo a passo completo
                   </Anchor>}>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing={{ base: 28, lg: 32 }}>
          <Passo numero="1" titulo="A ONG publica">
            A vaga entra com data, local, carga horária e número de participantes.
          </Passo>
          <Passo numero="2" titulo="Você se inscreve">
            Escolhe pela data e pela cidade, e se inscreve com um clique.
          </Passo>
          <Passo numero="3" titulo="Presença por QR Code">
            No local, você lê um QR que muda a cada 30 segundos. Foto repassada não
            funciona.
          </Passo>
          <Passo numero="4" titulo="O certificado sai">
            A ONG confirma a presença e o certificado é emitido com assinatura digital.
          </Passo>
        </SimpleGrid>
      </Secao>

      <Box component="section" className="mh-secao mh-secao-nevoa">
        <Container size={LARGURA_DO_PORTAL}>
          <Grid gutter={{ base: 40, md: 64 }} align="center">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Title order={2} fz={{ base: 26, md: 32 }} lh={1.15} maw={520}>
                Um certificado que qualquer pessoa confere
              </Title>
              <Stack gap="md" mt="lg" maw={540}>
                <Text fz="lg" c="dimmed">
                  Cada certificado tem um código único e um QR Code. Quem recebe abre a
                  página de verificação e vê os dados direto da base da Mais Horas, e não
                  do arquivo que chegou por e-mail.
                </Text>
                <Text fz="lg" c="dimmed">
                  Os dados são assinados no momento da emissão. Se alguém alterar uma hora
                  no banco, a verificação mostra a adulteração.
                </Text>
              </Stack>
              <Group gap="md" mt="xl">
                <Button variant="default" component={Link} to="/verificar">
                  Verificar um certificado
                </Button>
                <Anchor component={Link} to="/como-funciona" fw={500}>
                  Como a assinatura funciona
                </Anchor>
              </Group>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Box maw={460} mx={{ base: 0, md: "auto" }}>
                <ExemplarCertificado />
              </Box>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      <Secao titulo="Para quem é">
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 32, md: 64 }}>
          <Box>
            <Title order={3} fz="xl">Estudantes</Title>
            <Text c="dimmed" fz="lg" mt="xs" maw={480}>
              Encontre vagas por data e cidade, inscreva-se com um clique e acompanhe as
              horas numa caderneta que soma tudo para você.
            </Text>
            <Anchor component={Link} to="/para-estudantes" fw={500} display="inline-block"
                    mt="md">
              Como funciona para estudantes
            </Anchor>
          </Box>
          <Box>
            <Title order={3} fz="xl">Organizações</Title>
            <Text c="dimmed" fz="lg" mt="xs" maw={480}>
              Publique uma atividade, escolha quem vai, registre a presença pelo celular e
              emita os certificados sem planilha.
            </Text>
            <Anchor component={Link} to="/para-ongs" fw={500} display="inline-block" mt="md">
              Como funciona para ONGs
            </Anchor>
          </Box>
        </SimpleGrid>
      </Secao>

      {parceiras?.itens?.length > 0 && (
        <Secao nevoa titulo="Organizações na plataforma"
               acao={<Anchor component={Link} to="/ongs" fw={500}>
                       Ver todas as organizações
                     </Anchor>}>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {parceiras.itens.map((ong) => <CartaoOng key={ong.id} ong={ong} />)}
          </SimpleGrid>
        </Secao>
      )}

      {numerosVisiveis(resumo).length > 0 && (
        <Secao titulo="O que já aconteceu por aqui"
               subtitulo="Contado direto da base da plataforma, sem arredondar.">
          <NumerosDeImpacto resumo={resumo} />
        </Secao>
      )}

      <ChamadaFinal />
    </>
  );
}
