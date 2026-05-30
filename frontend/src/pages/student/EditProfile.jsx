import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  SimpleGrid,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Avatar,
  FileButton,
  Stack,
  Divider,
  Text,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconDeviceFloppy, IconUpload } from "@tabler/icons-react";
import dayjs from "dayjs";

import BackButton from "../../components/ui/BackButton";
import PageHeader from "../../components/ui/PageHeader";
import Loading from "../../components/ui/Loading";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { notifyError, notifySuccess } from "../../utils/notify";
import { resolveImage, initials } from "../../utils/format";

export default function EditStudentProfile() {
  const navigate = useNavigate();
  const { setUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const form = useForm({
    initialValues: {
      name: "",
      fullName: "",
      sex: "",
      birthDate: null,
      phone: "",
      city: "",
      state: "",
      neighborhood: "",
      institution: "",
      courseName: "",
      linkedin: "",
      aboutMe: "",
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/profile");
        const u = data.user;
        const sp = u.studentProfile || {};
        form.setValues({
          name: u.name || "",
          fullName: sp.fullName || "",
          sex: sp.sex || "",
          birthDate: sp.birthDate ? new Date(sp.birthDate) : null,
          phone: sp.phone || "",
          city: sp.city || "",
          state: sp.state || "",
          neighborhood: sp.neighborhood || "",
          institution: sp.institution || "",
          courseName: sp.courseName || "",
          linkedin: sp.linkedin || "",
          aboutMe: sp.aboutMe || "",
        });
        setPhotoPreview(resolveImage(sp.photo, sp.photoUrl));
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
      Object.entries(values).forEach(([k, v]) => {
        if (k === "birthDate") {
          fd.append("birthDate", v ? dayjs(v).format("YYYY-MM-DD") : "");
        } else {
          fd.append(k, v ?? "");
        }
      });
      if (photoFile) fd.append("photo", photoFile);

      const { data } = await api.put("/users/profile", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUserData(data.user);
      notifySuccess("Perfil atualizado!");
      navigate("/dashboard");
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

      <PageHeader
        eyebrow="Conta do estudante"
        title="Editar perfil"
        subtitle="Mantenha seus dados atualizados."
      />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Paper withBorder radius="md" p={{ base: "lg", sm: "xl" }} className="mh-page-band">
          <Group mb="lg">
            <Avatar src={photoPreview} size={80} radius="xl" color="brand">
              {initials(form.values.fullName || form.values.name)}
            </Avatar>
            <FileButton onChange={handlePhoto} accept="image/png,image/jpeg,image/webp">
              {(props) => (
                <Button variant="light" leftSection={<IconUpload size={16} />} {...props}>
                  Trocar foto
                </Button>
              )}
            </FileButton>
          </Group>

          <Text fw={700} mb="xs">
            Dados pessoais
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Nome de exibição" {...form.getInputProps("name")} />
            <TextInput label="Nome completo" {...form.getInputProps("fullName")} />
            <Select
              label="Sexo"
              data={[
                { value: "male", label: "Masculino" },
                { value: "female", label: "Feminino" },
                { value: "other", label: "Outro" },
                { value: "prefer_not_say", label: "Prefiro não dizer" },
              ]}
              clearable
              {...form.getInputProps("sex")}
            />
            <DateInput
              label="Data de nascimento"
              valueFormat="DD/MM/YYYY"
              clearable
              {...form.getInputProps("birthDate")}
            />
            <TextInput label="Telefone" {...form.getInputProps("phone")} />
            <TextInput label="LinkedIn" {...form.getInputProps("linkedin")} />
          </SimpleGrid>

          <Divider my="lg" />
          <Text fw={700} mb="xs">
            Localização
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Cidade" {...form.getInputProps("city")} />
            <TextInput label="Estado" {...form.getInputProps("state")} />
            <TextInput label="Bairro" {...form.getInputProps("neighborhood")} />
          </SimpleGrid>

          <Divider my="lg" />
          <Text fw={700} mb="xs">
            Formação
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Instituição" {...form.getInputProps("institution")} />
            <TextInput label="Curso" {...form.getInputProps("courseName")} />
          </SimpleGrid>

          <Textarea
            label="Sobre mim"
            mt="md"
            autosize
            minRows={3}
            maxLength={1000}
            {...form.getInputProps("aboutMe")}
          />

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => navigate(-1)}>
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
