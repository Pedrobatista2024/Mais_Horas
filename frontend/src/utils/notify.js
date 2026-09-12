import { notifications } from "@mantine/notifications";

export function notifySuccess(message, title = "Tudo certo") {
  notifications.show({ title, message, color: "brand" });
}

/**
 * Aceita string pronta ou o erro do axios.
 *
 * A API responde `{ codigo, mensagem, detalhes }`; os dois campos antigos
 * (`message`/`error`) seguem na lista só para não quebrar tela ainda não
 * migrada.
 */
export function notifyError(error, fallback = "Algo deu errado") {
  const corpo = error?.response?.data;
  const message =
    typeof error === "string"
      ? error
      : corpo?.mensagem || corpo?.message || corpo?.error || error?.message || fallback;
  notifications.show({ title: "Ops", message, color: "red" });
}

export function notifyInfo(message, title = "Aviso") {
  notifications.show({ title, message, color: "navy" });
}
