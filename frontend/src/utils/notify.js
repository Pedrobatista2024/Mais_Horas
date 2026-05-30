import { notifications } from "@mantine/notifications";

export function notifySuccess(message, title = "Tudo certo") {
  notifications.show({ title, message, color: "brand" });
}

export function notifyError(error, fallback = "Algo deu errado") {
  const message =
    typeof error === "string"
      ? error
      : error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback;
  notifications.show({ title: "Ops", message, color: "red" });
}

export function notifyInfo(message, title = "Aviso") {
  notifications.show({ title, message, color: "navy" });
}
