import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Anchor, Button, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconLock, IconMail } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

/** T7 — Entrar. Ponto de acesso único para os três perfis (D9). */
export default function Entrar() {
  const navigate = useNavigate();
  const { entrar } = useAuth();
  const [enviando, setEnviando] = useState(false);

  const form = useForm({
    initialValues: { email: "", senha: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "E-mail inválido"),
      senha: (v) => (v.length >= 1 ? null : "Informe a senha"),
    },
  });

  async function enviar(valores) {
    setEnviando(true);
    try {
      const { data } = await api.post("/auth/entrar", valores);
      entrar(data);
      notifySuccess(`Bem-vindo(a), ${data.usuario.nome}!`);
      navigate(painelDe(data.usuario.papel), { replace: true });
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível entrar"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout title="Entrar" subtitle="Acesse sua conta para continuar">
      <form onSubmit={form.onSubmit(enviar)}>
        <Stack>
          <TextInput
            label="E-mail"
            placeholder="voce@email.com"
            leftSection={<IconMail size={16} />}
            autoComplete="email"
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Senha"
            placeholder="Sua senha"
            leftSection={<IconLock size={16} />}
            autoComplete="current-password"
            {...form.getInputProps("senha")}
          />

          <Group justify="flex-end" mt={-8}>
            <Anchor component={Link} to="/esqueci-senha" size="sm">
              Esqueci minha senha
            </Anchor>
          </Group>

          <Button type="submit" loading={enviando} fullWidth mt="xs">
            Entrar
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            Ainda não tem conta?{" "}
            <Anchor component={Link} to="/criar-conta" fw={600}>
              Criar conta
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
