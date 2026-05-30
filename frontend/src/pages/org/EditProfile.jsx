import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  SimpleGrid,
  TextInput,
  Textarea,
  Button,
  Group,
  Avatar,
  FileButton,
  Divider,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconDeviceFloppy,
  IconUpload,
  IconBuildingCommunity,
} from "@tabler/icons-react";

import BackButton from "../../components/ui/BackButton";
import PageHeader from "../../components/ui/PageHeader";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { notifyError, notifySuccess } from "../../utils/notify";
import { resolveImage } from "../../utils/format";

export default function OrgEditProfile() {
  const navigate = useNavigate();
  const { setUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const form = useForm({
    initialValues: {
      name: "",
      organizationName: "",
      cnpj: "",
      phone: "",
      website: "",
      instagram: "",
      address: "",
      description: "",
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/profile");
        const u = data.user;
        const op = u.organizationProfile || {};
        form.setValues({
          name: u.name || "",
          organizationName: op.organizationName || "",
          cnpj: op.cnpj || "",
          phone: op.phone || "",
          website: op.website || "",
          instagram: op.instagram || "",
          address: op.address || "",
          description: op.description || "",
        });
        setPhotoPreview(resolveImage(op.photo));
      } catch (err) {
        notifyError(err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePhoto(file) {
    setPhotoFile(file);
    if (file) setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(values) {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => fd.append(k, v ?? ""));
      if (photoFile) fd.append("photo", photoFile);

      const { data } = await api.put("/users/profile", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUserData(data.user);
      notifySuccess("Perfil atualizado!");
      navigate("/org/profile");
    } catch (err) {
      notifyError(err, "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <BackButton onClick={() => navigate(-1)} />

      <PageHeader eyebrow="Conta da organização" title="Editar perfil da organização" />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} className="mh-page-band">
          <Group mb="lg">
            <Avatar src={photoPreview} size={80} radius="md" color="navy">
              <IconBuildingCommunity size={36} />
            </Avatar>
            <FileButton onChange={handlePhoto} accept="image/png,image/jpeg,image/webp">
              {(props) => (
                <Button variant="light" leftSection={<IconUpload size={16} />} {...props}>
                  Trocar logo
                </Button>
              )}
            </FileButton>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Nome de exibição" {...form.getInputProps("name")} />
            <TextInput label="Nome da organização" {...form.getInputProps("organizationName")} />
            <TextInput label="CNPJ" {...form.getInputProps("cnpj")} />
            <TextInput label="Telefone" {...form.getInputProps("phone")} />
            <TextInput label="Website" {...form.getInputProps("website")} />
            <TextInput label="Instagram" {...form.getInputProps("instagram")} />
          </SimpleGrid>

          <TextInput label="Endereço" mt="md" {...form.getInputProps("address")} />

          <Divider my="lg" />
          <Text fw={700} mb="xs">
            Sobre a organização
          </Text>
          <Textarea
            autosize
            minRows={4}
            maxLength={1000}
            placeholder="Conte o que sua organização faz, missão, áreas de atuação..."
            {...form.getInputProps("description")}
          />

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => navigate("/org/profile")}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} leftSection={<IconDeviceFloppy size={18} />}>
              Salvar alterações
            </Button>
          </Group>
        </Paper>
      </form>
    </>
  );
}
