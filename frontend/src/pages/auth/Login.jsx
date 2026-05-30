import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TextInput, PasswordInput, Button, Stack, Text, Anchor } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconMail, IconLock } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { notifyError, notifySuccess } from "../../utils/notify";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email inválido"),
      password: (v) => (v.length >= 1 ? null : "Informe a senha"),
    },
  });

  async function handleSubmit(values) {
    setLoading(true);
    try {
      const { data } = await api.post("/users/login", values);
      login(data);
      notifySuccess(`Bem-vindo(a), ${data.user.name}!`);
      navigate(data.user.role === "organization" ? "/org" : "/dashboard");
    } catch (err) {
      notifyError(err, "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua conta para continuar">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <TextInput
            label="Email"
            placeholder="voce@email.com"
            leftSection={<IconMail size={16} />}
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Senha"
            placeholder="Sua senha"
            leftSection={<IconLock size={16} />}
            {...form.getInputProps("password")}
          />
          <Button type="submit" loading={loading} fullWidth mt="xs">
            Entrar
          </Button>
          <Text size="sm" ta="center" c="dimmed">
            Não tem conta?{" "}
            <Anchor component={Link} to="/register" fw={600}>
              Cadastre-se
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
