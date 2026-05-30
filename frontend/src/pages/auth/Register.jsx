import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Text,
  Anchor,
  SegmentedControl,
  Input,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconMail, IconLock, IconUser } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { notifyError, notifySuccess } from "../../utils/notify";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { name: "", email: "", password: "", role: "student" },
    validate: {
      name: (v) => (v.trim().length >= 2 ? null : "Informe seu nome"),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email inválido"),
      password: (v) => (v.length >= 6 ? null : "Mínimo de 6 caracteres"),
    },
  });

  async function handleSubmit(values) {
    setLoading(true);
    try {
      const { data } = await api.post("/users/register", values);
      login(data);
      notifySuccess("Conta criada com sucesso!");
      navigate(data.user.role === "organization" ? "/org" : "/dashboard");
    } catch (err) {
      notifyError(err, "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Comece a usar o Mais Horas">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <Input.Wrapper label="Eu sou">
            <SegmentedControl
              fullWidth
              data={[
                { label: "Estudante", value: "student" },
                { label: "ONG / Organização", value: "organization" },
              ]}
              {...form.getInputProps("role")}
            />
          </Input.Wrapper>

          <TextInput
            label={form.values.role === "organization" ? "Nome da organização" : "Nome completo"}
            placeholder="Como devemos te chamar?"
            leftSection={<IconUser size={16} />}
            {...form.getInputProps("name")}
          />
          <TextInput
            label="Email"
            placeholder="voce@email.com"
            leftSection={<IconMail size={16} />}
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Senha"
            placeholder="Mínimo 6 caracteres"
            leftSection={<IconLock size={16} />}
            {...form.getInputProps("password")}
          />
          <Button type="submit" loading={loading} fullWidth mt="xs">
            Cadastrar
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            Já tem conta?{" "}
            <Anchor component={Link} to="/login" fw={600}>
              Entrar
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
