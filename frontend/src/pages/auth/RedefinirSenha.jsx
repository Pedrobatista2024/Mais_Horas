import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Anchor, Button, PasswordInput, Stack, Text } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertTriangle, IconLock } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const SENHA_MINIMA = 8;

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const token = parametros.get("token");
  const [enviando, setEnviando] = useState(false);

  const form = useForm({
    initialValues: { senha: "", confirmacao: "" },
    validate: {
      senha: (v) =>
        v.length >= SENHA_MINIMA ? null : `Use ao menos ${SENHA_MINIMA} caracteres`,
      confirmacao: (v, valores) =>
        v === valores.senha ? null : "As senhas não coincidem",
    },
  });

  async function enviar(valores) {
    setEnviando(true);
    try {
      await api.post("/auth/senha/redefinir", { token, senha: valores.senha });
      notifySuccess("Senha redefinida. Entre com a nova senha.");
      navigate("/entrar", { replace: true });
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível redefinir a senha"));
    } finally {
      setEnviando(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Link inválido">
        <Stack>
          <Alert icon={<IconAlertTriangle size={18} />} color="red" variant="light">
            Este link não é válido. Solicite um novo para redefinir a senha.
          </Alert>
          <Anchor component={Link} to="/esqueci-senha" ta="center" fw={600}>
            Solicitar novo link
          </Anchor>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha para acessar sua conta">
      <form onSubmit={form.onSubmit(enviar)}>
        <Stack>
          <PasswordInput
            label="Nova senha"
            placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
            leftSection={<IconLock size={16} />}
            autoComplete="new-password"
            {...form.getInputProps("senha")}
          />
          <PasswordInput
            label="Confirme a nova senha"
            placeholder="Repita a senha"
            leftSection={<IconLock size={16} />}
            autoComplete="new-password"
            {...form.getInputProps("confirmacao")}
          />
          <Text size="xs" c="dimmed">
            Ao redefinir, todas as sessões abertas serão encerradas — inclusive em
            outros dispositivos.
          </Text>
          <Button type="submit" loading={enviando} fullWidth>
            Redefinir senha
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
