import { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconMail, IconMailCheck } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError } from "../../utils/notify";

export default function EsqueciSenha() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const form = useForm({
    initialValues: { email: "" },
    validate: { email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "E-mail inválido") },
  });

  async function enviar(valores) {
    setEnviando(true);
    try {
      await api.post("/auth/senha/esqueci", valores);
      setEnviado(true);
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível enviar as instruções"));
    } finally {
      setEnviando(false);
    }
  }

  // A confirmação é a mesma exista ou não a conta: dizer "e-mail não
  // encontrado" revelaria quais endereços estão cadastrados.
  if (enviado) {
    return (
      <AuthLayout title="Verifique seu e-mail">
        <Stack>
          <Alert icon={<IconMailCheck size={18} />} color="brand" variant="light">
            Se <b>{form.values.email}</b> estiver cadastrado, enviamos um link para
            redefinir a senha. Ele vale por 1 hora.
          </Alert>
          <Text size="sm" c="dimmed">
            Não recebeu? Confira a caixa de spam ou tente novamente em alguns minutos.
          </Text>
          <Anchor component={Link} to="/entrar" ta="center" fw={600}>
            Voltar para o acesso
          </Anchor>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail e enviaremos um link para criar uma nova senha"
    >
      <form onSubmit={form.onSubmit(enviar)}>
        <Stack>
          <TextInput
            label="E-mail"
            placeholder="voce@email.com"
            leftSection={<IconMail size={16} />}
            autoComplete="email"
            {...form.getInputProps("email")}
          />
          <Button type="submit" loading={enviando} fullWidth>
            Enviar instruções
          </Button>
          <Anchor component={Link} to="/entrar" ta="center" size="sm">
            Voltar para o acesso
          </Anchor>
        </Stack>
      </form>
    </AuthLayout>
  );
}
