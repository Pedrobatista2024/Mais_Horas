import { useState } from "react";
import { Card, Group, Text, Stack, Button, Badge, CopyButton, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconCertificate,
  IconDownload,
  IconSearch,
  IconCopy,
  IconCheck,
  IconExternalLink,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import Loading from "../../components/ui/Loading";
import EmptyState from "../../components/ui/EmptyState";
import { useFetch } from "../../hooks/useFetch";
import { api } from "../../services/api";
import { notifyError } from "../../utils/notify";
import { formatDate } from "../../utils/format";

export default function MyCertificates() {
  const navigate = useNavigate();
  const { data, loading } = useFetch("/certificates/my");
  const [downloading, setDownloading] = useState(null);

  async function handleDownload(id) {
    setDownloading(id);
    try {
      const res = await api.get(`/certificates/${id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch (err) {
      notifyError(err, "Erro ao gerar PDF");
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <Loading />;

  const certs = data || [];

  return (
    <>
      <PageHeader
        title="Meus certificados"
        subtitle="Certificados emitidos pelas ONGs. Cada um pode ser validado por QR Code."
      />

      {certs.length === 0 ? (
        <EmptyState
          icon={IconCertificate}
          title="Nenhum certificado ainda"
          description="Participe de atividades e tenha sua presença confirmada para receber certificados."
          action={{
            label: "Buscar atividades",
            icon: <IconSearch size={16} />,
            onClick: () => navigate("/activities"),
          }}
        />
      ) : (
        <Stack gap="md">
          {certs.map((cert) => (
            <Card key={cert._id} withBorder radius="md" padding="lg">
              <Group justify="space-between" align="flex-start" wrap="wrap">
                <div style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={700}>{cert.activity?.title || "Atividade"}</Text>
                    <Badge color="brand" variant="light">
                      {cert.hours}h
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed" mt={2}>
                    Emitido em {formatDate(cert.issuedAt || cert.createdAt)}
                  </Text>
                  <Group gap={6} mt="xs" align="center">
                    <Text size="xs" c="dimmed">
                      Código:
                    </Text>
                    <Text size="xs" ff="monospace">
                      {cert.verificationCode}
                    </Text>
                    <CopyButton value={cert.verificationCode}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Copiado" : "Copiar"}>
                          <ActionIcon variant="subtle" color="gray" size="sm" onClick={copy}>
                            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </div>

                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconExternalLink size={16} />}
                    onClick={() => navigate(`/verificar/${cert.verificationCode}`)}
                  >
                    Verificar
                  </Button>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    loading={downloading === cert._id}
                    onClick={() => handleDownload(cert._id)}
                  >
                    PDF
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
