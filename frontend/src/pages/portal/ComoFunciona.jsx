import { Link } from "react-router-dom";
import {
  Badge, Box, Button, Code, Grid, Group, Stack, Text, Title,
} from "@mantine/core";

import AberturaComFoto from "../../components/portal/AberturaComFoto";
import ChamadaFinal from "../../components/portal/ChamadaFinal";
import Secao from "../../components/portal/Secao";
import { cadastroComo } from "../../components/portal/navegacao";
import { useAuth } from "../../context/AuthContext";
import { useConsultaPublica } from "../../hooks/useConsultaPublica";
import { useTitulo } from "../../hooks/useTitulo";

const JORNADA = [
  { titulo: "A ONG publica a atividade",
    texto: "Começa como rascunho, com data, horário, local, carga horária e limite de vagas. Publicada, entra na vitrine. Depois que alguém se inscreve, só o número de vagas pode mudar." },
  { titulo: "O estudante se inscreve",
    texto: "Com o perfil completo (nome, instituição e curso), ele se inscreve. A ONG decide se confirma na hora ou avalia cada pedido. Cada estudante pode ter até 5 inscrições ativas." },
  { titulo: "No dia, check-in pelo QR Code",
    texto: "A ONG mostra um QR que muda a cada 30 segundos. O estudante lê com o celular e o horário fica registrado. Quem ficar sem sinal pode ser registrado pela ONG, e o registro fica marcado como manual." },
  { titulo: "A ONG confirma a presença",
    texto: "O check-in é evidência, não decisão: quem marca presente ou ausente é a organização. A atividade só fecha quando ninguém fica sem decisão." },
  { titulo: "O certificado sai assinado",
    texto: "Ao fechar a atividade, cada presente recebe o certificado na hora, em PDF, com código único e QR Code." },
  { titulo: "Qualquer pessoa confere",
    texto: "A coordenação lê o QR ou digita o código e vê os dados do certificado, sem precisar de conta." },
];

const DESFECHOS = [
  { cor: "green", titulo: "Válido", texto: "A assinatura confere com todos os dados mostrados." },
  { cor: "orange", titulo: "Revogado",
    texto: "Foi emitido, mas a administração o invalidou. A página mostra a data e o motivo." },
  { cor: "red", titulo: "Adulterado",
    texto: "Algum dado não bate com a assinatura. A tentativa fica registrada." },
  { cor: "gray", titulo: "Não encontrado", texto: "Nenhum certificado com esse código foi emitido aqui." },
];

/**
 * T2 — Como funciona.
 *
 * A página que sustenta a conversa técnica sem exigir login: a jornada
 * inteira e por que a foto do QR e o certificado editado não passam.
 */
export default function ComoFunciona() {
  useTitulo("Como funciona");
  const { autenticado } = useAuth();
  const resumo = useConsultaPublica("/portal/resumo");
  const exemplo = resumo?.codigoDemonstracao;

  return (
    <>
      <AberturaComFoto foto="/portal/mutirao.jpg" fotoMenor="/portal/mutirao-1200.jpg"
                       alt="Grupo de voluntários de camiseta azul limpando uma praia"
                       posicao="60% 45%" baixa>
        <Stack gap="lg" maw={640}>
          <Title order={1} className="mh-serif" c="white" fz={{ base: 36, sm: 48, lg: 56 }}>
            Do anúncio ao certificado conferido
          </Title>
          <Text c="rgba(255,255,255,0.88)" fz={{ base: "md", md: "xl" }} maw={560}>
            Cada etapa deixa registro. É isso que permite à instituição aceitar o
            certificado sem precisar ligar para a ONG.
          </Text>
          <Group gap="sm">
            {!autenticado && (
              <Button variant="white" component={Link} to={cadastroComo("estudante")}
                      className="mh-botao-portal">
                Criar conta
              </Button>
            )}
            <Button variant="outline" color="#ffffff" component={Link}
                    to={exemplo ? `/verificar/${exemplo}` : "/verificar"}
                    className="mh-botao-portal">
              {exemplo ? "Ver uma verificação de exemplo" : "Verificar um certificado"}
            </Button>
          </Group>
        </Stack>
      </AberturaComFoto>

      <Secao titulo="Seis etapas, do começo ao fim">
        <Box component="ol" p={0} m={0} maw={760} style={{ listStyle: "none" }}>
          {JORNADA.map(({ titulo, texto }, i) => (
            <Group key={titulo} component="li" gap="lg" wrap="nowrap" align="flex-start"
                   py="md" style={{ borderTop: i ? "1px solid var(--mh-linha)" : 0 }}>
              <Text className="mh-serif" c="var(--mh-royal)" fz={44} lh={1} w={44}
                    aria-hidden="true">
                {i + 1}
              </Text>
              <Box>
                <Text fw={600} fz="lg">{titulo}</Text>
                <Text c="dimmed" mt={2}>{texto}</Text>
              </Box>
            </Group>
          ))}
        </Box>
      </Secao>

      <Secao nevoa titulo="Por que a foto do QR não funciona">
        <Grid gutter={{ base: 32, md: 64 }}>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md" maw={600}>
              <Text fz="lg">
                O QR que a ONG mostra é um código que <b>muda a cada 30 segundos</b>. Ele
                leva a identificação da atividade, a janela de tempo e uma assinatura
                calculada com um segredo que só o servidor conhece.
              </Text>
              <Text fz="lg">
                Quando o estudante lê o código, o servidor refaz a conta. Se a janela já
                passou (há uma folga de 10 segundos para quem leu no último instante), o
                código é recusado. Uma foto repassada no grupo chega velha demais.
              </Text>
              <Text c="dimmed">
                Nenhum código é guardado: validar é recalcular. Não existe lista de
                códigos para vazar.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Text fw={600} mb="sm">O que o check-in registra</Text>
            <Box className="mh-lista">
              {["Quem fez e em que horário", "Se veio do QR ou foi registrado pela ONG",
                "Quem registrou, no caso manual"].map((item) => (
                <Text key={item} className="mh-linha">{item}</Text>
              ))}
            </Box>
            <Text size="sm" c="dimmed" mt="md">
              A presença final continua sendo decisão da ONG. Se ela divergir do check-in,
              a diferença fica visível para auditoria.
            </Text>
          </Grid.Col>
        </Grid>
      </Secao>

      <Secao titulo="Assinado, não só impresso">
        <Grid gutter={{ base: 32, md: 64 }}>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md" maw={600}>
              <Text fz="lg">
                Na emissão, o sistema assina com uma chave privada (<b>Ed25519</b>) os dados
                que a verificação mostra: código, nome do estudante, organização,
                atividade, horas, data e momento da emissão.
              </Text>
              <Text fz="lg">
                Na verificação, a assinatura é conferida contra esses mesmos dados. Mudar
                uma letra do nome ou somar uma hora no banco basta para o certificado
                aparecer como adulterado.
              </Text>
              <Text c="dimmed">
                Cada certificado tem um código de 16 caracteres, como{" "}
                <Code>a1b2c3d4e5f60718</Code>, impresso junto com o QR. A página de
                verificação é pública e não pede login.
              </Text>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Text fw={600} mb="sm">O que a verificação pode responder</Text>
            <Box className="mh-lista">
              {DESFECHOS.map(({ cor, titulo, texto }) => (
                <Box key={titulo} className="mh-linha">
                  <Badge color={cor} size="lg">{titulo}</Badge>
                  <Text size="sm" c="dimmed" mt={6}>{texto}</Text>
                </Box>
              ))}
            </Box>
          </Grid.Col>
        </Grid>
      </Secao>

      <ChamadaFinal />
    </>
  );
}
