import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Anchor, Button, PasswordInput, Progress, SegmentedControl, Stack, Text, TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconLock, IconMail, IconUser } from "@tabler/icons-react";

import AuthLayout from "../../components/layout/AuthLayout";
import { useAuth } from "../../context/AuthContext";
import { painelDe } from "../../routes/destinos";
import { api, mensagemDoErro } from "../../services/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const SENHA_MINIMA = 8;

/** Força da senha, só como orientação visual — a regra dura é o tamanho. */
function forcaDaSenha(senha) {
  if (!senha) return { valor: 0, cor: "gray", rotulo: "" };
  let pontos = Math.min(senha.length / SENHA_MINIMA, 1) * 40;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 20;
  if (/\d/.test(senha)) pontos += 20;
  if (/[^A-Za-z0-9]/.test(senha)) pontos += 20;

  const valor = Math.min(Math.round(pontos), 100);
  if (valor < 40) return { valor, cor: "red", rotulo: "Fraca" };
  if (valor < 70) return { valor, cor: "yellow", rotulo: "Razoável" };
  return { valor, cor: "brand", rotulo: "Boa" };
}

/** T8 — Criar conta. O papel é escolha explícita, sem padrão silencioso. */
export default function CriarConta() {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const { entrar } = useAuth();
  const [enviando, setEnviando] = useState(false);

  const papelInicial = ["estudante", "ong"].includes(parametros.get("papel"))
    ? parametros.get("papel")
    : "estudante";

  const form = useForm({
    initialValues: { nome: "", email: "", senha: "", papel: papelInicial },
    validate: {
      nome: (v) => (v.trim().length >= 2 ? null : "Informe seu nome"),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "E-mail inválido"),
      senha: (v) =>
        v.length >= SENHA_MINIMA ? null : `Use ao menos ${SENHA_MINIMA} caracteres`,
    },
  });

  const forca = forcaDaSenha(form.values.senha);

  async function enviar(valores) {
    setEnviando(true);
    try {
      const { data } = await api.post("/auth/cadastro", valores);
      entrar(data);
      notifySuccess("Conta criada. Bem-vindo(a) ao Mais Horas!");
      navigate(painelDe(data.usuario.papel), { replace: true });
    } catch (erro) {
      notifyError(mensagemDoErro(erro, "Não foi possível criar a conta"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout title="Criar conta" subtitle="Leva menos de um minuto">
      <form onSubmit={form.onSubmit(enviar)}>
        <Stack>
          <div>
            <Text size="sm" fw={500} mb={6}>
              Você é
            </Text>
            <SegmentedControl
              fullWidth
              data={[
                { label: "Estudante", value: "estudante" },
                { label: "ONG", value: "ong" },
              ]}
              {...form.getInputProps("papel")}
            />
          </div>

          <TextInput
            label={form.values.papel === "ong" ? "Nome da organização" : "Seu nome"}
            placeholder={form.values.papel === "ong" ? "ONG Verde Vida" : "Maria Silva"}
            leftSection={<IconUser size={16} />}
            autoComplete="name"
            {...form.getInputProps("nome")}
          />
          <TextInput
            label="E-mail"
            placeholder="voce@email.com"
            leftSection={<IconMail size={16} />}
            autoComplete="email"
            {...form.getInputProps("email")}
          />
          <div>
            <PasswordInput
              label="Senha"
              placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
              leftSection={<IconLock size={16} />}
              autoComplete="new-password"
              {...form.getInputProps("senha")}
            />
            {form.values.senha && (
              <>
                <Progress value={forca.valor} color={forca.cor} size="xs" mt={8} />
                <Text size="xs" c="dimmed" mt={4}>
                  Força da senha: {forca.rotulo}
                </Text>
              </>
            )}
          </div>

          <Button type="submit" loading={enviando} fullWidth mt="xs">
            Criar conta
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            Já tem conta?{" "}
            <Anchor component={Link} to="/entrar" fw={600}>
              Entrar
            </Anchor>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
