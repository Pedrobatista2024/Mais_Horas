import { Link } from "react-router-dom";
import {
  Anchor, Box, Button, Center, Container, Grid, Group, SimpleGrid, Stack, Text,
  ThemeIcon, Title,
} from "@mantine/core";
import {
  IconCertificate, IconCheck, IconQrcode, IconSearch, IconUserCheck,
} from "@tabler/icons-react";

import AberturaComFoto from "../../components/portal/AberturaComFoto";
import BuscaDeVagas from "../../components/portal/BuscaDeVagas";
import CartaoOng from "../../components/portal/CartaoOng";
import CelularDeExemplo from "../../components/portal/CelularDeExemplo";
import Comparativo from "../../components/portal/Comparativo";
import PerguntasFrequentes from "../../components/portal/PerguntasFrequentes";
import Secao from "../../components/portal/Secao";
import { cadastroComo, LARGURA_DO_PORTAL } from "../../components/portal/navegacao";
import { useAuth } from "../../context/AuthContext";
import { useConsultaPublica } from "../../hooks/useConsultaPublica";
import { useTitulo } from "../../hooks/useTitulo";

const RECURSOS = [
  { icone: IconSearch, titulo: "Vagas por data e cidade",
    texto: "As ONGs publicam com local, horário e carga horária. Você filtra e escolhe.",
    para: "/vagas", rotulo: "Ver vagas" },
  { icone: IconUserCheck, titulo: "Inscrição com um clique",
    texto: "Com o perfil completo, a inscrição sai na hora. Algumas vagas passam pela aprovação da ONG.",
    para: "/para-estudantes", rotulo: "Como se inscrever" },
  { icone: IconQrcode, titulo: "Presença pelo QR Code",
    texto: "No local, você lê um código que muda a cada 30 segundos. A foto repassada não serve.",
    para: "/como-funciona", rotulo: "Por que o QR muda" },
  { icone: IconCertificate, titulo: "Certificado que se confere",
    texto: "Assinado digitalmente. A coordenação confere pelo QR, sem ligar para ninguém.",
    para: "/verificar", rotulo: "Verificar um certificado" },
];

const PERGUNTAS = [
  { pergunta: "Quanto custa?",
    resposta: "Nada. A plataforma é gratuita para estudantes e organizações." },
  { pergunta: "Quem pode se inscrever?",
    resposta: "Qualquer estudante com conta e perfil completo: nome, instituição e curso, que são o que sai no certificado." },
  { pergunta: "Como a faculdade confere o certificado?",
    resposta: "Pelo QR Code ou pelo código impresso. A página de verificação mostra os dados direto da base e confere a assinatura digital." },
  { pergunta: "Posso mandar a foto do QR para um colega?",
    resposta: "Não adianta. O código muda a cada 30 segundos e deixa de valer logo depois. Ele serve para quem está no local." },
  { pergunta: "Minha ONG pode publicar vagas?",
    resposta: "Pode. Crie a conta como organização, complete o perfil e publique a primeira atividade. Não há custo." },
  { pergunta: "E se eu não puder ir?",
    resposta: "Cancele a inscrição antes do início da atividade. Assim a vaga fica livre para outra pessoa." },
];

/** Tela de celular: a presença registrada, como o aluno vê depois do QR. */
function TelaDePresenca() {
  return (
    <Stack gap={0} align="center" pt={36}>
      <ThemeIcon variant="light" color="green" size={64} radius="xl">
        <IconCheck size={34} stroke={2} />
      </ThemeIcon>
      <Text fw={600} mt="md">Presença registrada</Text>
      <Text size="xs" c="dimmed" ta="center" mt={4}>Mutirão no mangue do Cocó</Text>
      <Text fw={600} size="sm" mt={4} className="mh-num">às 8h12</Text>
      <Box w="100%" mt={28} py={8} ta="center" style={{ borderRadius: 6, background: "var(--mh-royal)" }}>
        <Text size="xs" fw={600} c="white">Ver minhas inscrições</Text>
      </Box>
    </Stack>
  );
}

/** Tela de celular: a caderneta de horas do painel. */
function TelaDeCaderneta() {
  const linhas = [["Plantio no Cocó", 4], ["Catalogação", 4], ["Contação de histórias", 2]];
  return (
    <Box pt={8}>
      <Text fw={600} size="sm">Olá, Larissa</Text>
      <Text fw={600} size="xs" mt="md" mb={6}>Caderneta de horas</Text>
      {linhas.map(([nome, horas]) => (
        <Group key={nome} justify="space-between" py={7}
               style={{ borderBottom: "1px solid var(--mh-linha)" }}>
          <Text size="xs">{nome}</Text>
          <Text size="xs" fw={500} className="mh-num">{horas} h</Text>
        </Group>
      ))}
      <Group justify="space-between" pt={8} mt={2}
             style={{ borderTop: "3px double var(--mh-tinta)" }}>
        <Text size="xs" fw={600}>Total</Text>
        <span className="mh-horas">10 h</span>
      </Group>
    </Box>
  );
}

/**
 * T1 — Início do portal.
 *
 * Página de apresentação: foto de gente fazendo voluntariado ocupando o topo,
 * a busca de vagas flutuando sobre ela, e seções que alternam branco,
 * azul-claro e azul-noite. As fotos são ilustrativas (Unsplash, ver
 * public/portal/LEIA-ME.md); todo número vem da API, e seção sem dado some.
 */
export default function Inicio() {
  useTitulo("Vagas de voluntariado para horas de extensão");
  const { autenticado } = useAuth();
  const resumo = useConsultaPublica("/portal/resumo");
  const vagas = useConsultaPublica("/atividades?tamanho=1");
  const parceiras = useConsultaPublica("/portal/ongs?tamanho=6");

  const totalDeVagas = vagas?.total ?? 0;
  const horas = resumo?.horasCertificadas ?? 0;
  const outrosNumeros = [
    { valor: resumo?.ongs, rotulo: "organizações" },
    { valor: resumo?.estudantes, rotulo: "estudantes" },
    { valor: resumo?.certificadosEmitidos, rotulo: "certificados emitidos" },
  ].filter((n) => (n.valor ?? 0) > 0);

  return (
    <>
      {totalDeVagas > 0 && (
        <Box className="mh-faixa-aviso">
          <Container size={LARGURA_DO_PORTAL}>
            <Group justify="center" gap={8} py={8} wrap="wrap">
              <Text size="sm" className="mh-num">
                {totalDeVagas} {totalDeVagas === 1 ? "vaga aberta" : "vagas abertas"} agora.
              </Text>
              <Anchor component={Link} to="/vagas" size="sm">Ver as vagas</Anchor>
            </Group>
          </Container>
        </Box>
      )}

      <AberturaComFoto
        foto="/portal/abertura.jpg" fotoMenor="/portal/abertura-1200.jpg"
        alt="Voluntários recolhendo lixo na beira de uma lagoa, no fim da tarde"
        lado={<BuscaDeVagas total={totalDeVagas} />}
      >
        <Stack gap="lg" maw={600}>
          <Title order={1} className="mh-serif" c="white" fz={{ base: 40, sm: 52, lg: 64 }}>
            Faça suas horas de extensão onde alguém precisa de ajuda
          </Title>
          <Text c="rgba(255,255,255,0.88)" fz={{ base: "md", md: "xl" }} maw={520}>
            ONGs publicam as vagas, você se inscreve e a presença é registrada por QR Code.
            O certificado sai assinado, e a coordenação do curso confere sozinha.
          </Text>
          <Group gap="lg">
            <Anchor component={Link} to="/como-funciona" c="white" fw={600} underline="always">
              Como funciona
            </Anchor>
            <Anchor component={Link} to="/verificar" c="white" fw={600} underline="always">
              Verificar um certificado
            </Anchor>
          </Group>
        </Stack>
      </AberturaComFoto>

      <Secao>
        <Grid gutter={{ base: 32, md: 72 }} align="center">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Box className="mh-foto-moldura" h={{ base: 280, md: 440 }}>
              <img src="/portal/historias.jpg" alt="Crianças sentadas no chão ouvindo uma história"
                   width={1400} height={932} loading="lazy" />
              <Box className="mh-foto-legenda">
                <Text fw={600}>Leitura, reforço escolar, mutirões, cozinha solidária</Text>
                <Text size="sm" c="rgba(255,255,255,0.85)">
                  Tudo isso conta como hora de extensão.
                </Text>
              </Box>
            </Box>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Title order={2} className="mh-serif" fz={{ base: 30, md: 42 }}>
              Seu voluntariado vira hora comprovada
            </Title>
            <Text fz="lg" c="dimmed" mt="md" maw={500}>
              Em vez de correr atrás de declaração assinada, você escolhe a vaga, participa
              e o certificado aparece na sua conta. Cada hora entra numa caderneta que soma
              tudo para você.
            </Text>
            <Group gap="md" mt="xl">
              {!autenticado && (
                <Button component={Link} to={cadastroComo("estudante")}
                        className="mh-botao-portal">
                  Criar conta de estudante
                </Button>
              )}
              <Anchor component={Link} to="/para-estudantes" fw={600}>
                Como funciona para estudantes
              </Anchor>
            </Group>
          </Grid.Col>
        </Grid>
      </Secao>

      <Secao fundo="azul">
        <Grid gutter={{ base: 28, md: 56 }}>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Title order={2} className="mh-serif" fz={{ base: 30, md: 40 }}>
              Tudo que a hora de extensão precisa, num lugar só
            </Title>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" className="mh-desliza">
              {RECURSOS.map(({ icone: Icone, titulo, texto, para, rotulo }) => (
                <Box key={titulo} className="mh-recurso">
                  <span className="mh-recurso-icone"><Icone size={22} stroke={1.75} /></span>
                  <Text fw={600} fz="lg" mt="md">{titulo}</Text>
                  <Text c="dimmed" mt={6}>{texto}</Text>
                  <Anchor component={Link} to={para} fw={600} size="sm" mt="md"
                          display="inline-block">
                    {rotulo}
                  </Anchor>
                </Box>
              ))}
            </SimpleGrid>
          </Grid.Col>
        </Grid>
      </Secao>

      <Secao centro titulo="A declaração em papel ficou para trás"
             subtitulo="O que muda quando a hora de extensão passa pela Mais Horas.">
        <Box maw={920} mx="auto">
          <Comparativo />
        </Box>
        {!autenticado && (
          <Center mt={40}>
            <Button component={Link} to={cadastroComo("estudante")} className="mh-botao-portal">
              Criar minha conta
            </Button>
          </Center>
        )}
      </Secao>

      <Box component="section" className="mh-faixa-foto">
        <img src="/portal/mutirao.jpg" alt="Grupo de voluntários de camiseta azul limpando uma praia"
             width={2000} height={1333} loading="lazy"
             srcSet="/portal/mutirao-1200.jpg 1200w, /portal/mutirao.jpg 2000w" sizes="100vw" />
        <Container size={LARGURA_DO_PORTAL} className="mh-faixa-foto-conteudo">
          <Box className="mh-cartao-flutuante" maw={480} p={{ base: 24, md: 36 }}>
            <Text fw={600} c="var(--mh-royal)" size="sm">Para organizações</Text>
            <Title order={2} className="mh-serif" fz={{ base: 28, md: 36 }} mt={6}>
              Voluntários certos, sem planilha
            </Title>
            <Text c="dimmed" mt="md">
              Publique a atividade, aprove quem vai, registre a presença pelo celular e emita
              os certificados com um clique. Os estudantes já chegam sabendo o horário e o
              local.
            </Text>
            <Group gap="md" mt="xl">
              {!autenticado && (
                <Button component={Link} to={cadastroComo("ong")} className="mh-botao-portal">
                  Cadastrar minha ONG
                </Button>
              )}
              <Anchor component={Link} to="/para-ongs" fw={600}>
                Como funciona para ONGs
              </Anchor>
            </Group>
          </Box>
        </Container>
      </Box>

      <Secao fundo="azul">
        <Grid gutter={{ base: 40, md: 64 }} align="center">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Title order={2} className="mh-serif" fz={{ base: 30, md: 42 }}>
              Do QR Code na atividade à caderneta no celular
            </Title>
            <Text fz="lg" c="dimmed" mt="md" maw={460}>
              A presença é registrada no local, a ONG confirma e o certificado entra na
              conta do aluno. As horas se somam sozinhas.
            </Text>
            <Anchor component={Link} to="/como-funciona" fw={600} mt="lg" display="inline-block">
              Ver o passo a passo
            </Anchor>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Group justify="center" gap={28} wrap="nowrap" style={{ overflow: "hidden" }}
                   py="md">
              <CelularDeExemplo rotulo="Tela de presença registrada">
                <TelaDePresenca />
              </CelularDeExemplo>
              <Box visibleFrom="sm">
                <CelularDeExemplo rotulo="Tela da caderneta de horas" deslocamento={36}>
                  <TelaDeCaderneta />
                </CelularDeExemplo>
              </Box>
            </Group>
          </Grid.Col>
        </Grid>
      </Secao>

      {horas > 0 && (
        <Secao fundo="noite">
          <Grid gutter={{ base: 32, md: 64 }} align="center">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Text c="rgba(255,255,255,0.78)" fz={{ base: 22, md: 28 }} className="mh-serif">
                Já são
              </Text>
              <Text className="mh-serif mh-num" c="var(--mh-hora)" fz={{ base: 64, md: 104 }}
                    lh={1}>
                {horas.toLocaleString("pt-BR")} horas
              </Text>
              <Text c="white" fz={{ base: 22, md: 28 }} className="mh-serif" mt="xs">
                de extensão certificadas pela plataforma.
              </Text>
            </Grid.Col>
            {outrosNumeros.length > 0 && (
              <Grid.Col span={{ base: 12, md: 6 }}>
                <SimpleGrid cols={outrosNumeros.length} spacing={0}
                            style={{ border: "1px solid rgba(255,255,255,0.16)", borderRadius: 16 }}>
                  {outrosNumeros.map((n, i) => (
                    <Box key={n.rotulo} p={{ base: "md", md: "xl" }} ta="center"
                         style={{ borderLeft: i ? "1px solid rgba(255,255,255,0.16)" : 0 }}>
                      <Text c="white" fw={600} fz={{ base: 28, md: 40 }} className="mh-num">
                        {n.valor.toLocaleString("pt-BR")}
                      </Text>
                      <Text c="rgba(255,255,255,0.72)" size="sm">{n.rotulo}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Grid.Col>
            )}
          </Grid>
        </Secao>
      )}

      {parceiras?.itens?.length > 0 && (
        <Secao titulo="Organizações que já estão aqui"
               acao={<Anchor component={Link} to="/ongs" fw={600}>Ver todas as organizações</Anchor>}>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {parceiras.itens.map((ong) => <CartaoOng key={ong.id} ong={ong} />)}
          </SimpleGrid>
        </Secao>
      )}

      <Secao fundo="azul" centro titulo="Perguntas frequentes">
        <Box maw={1000} mx="auto">
          <PerguntasFrequentes itens={PERGUNTAS} />
        </Box>
      </Secao>
    </>
  );
}
