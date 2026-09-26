import {
  IconCalendarEvent, IconCertificate, IconClipboardCheck, IconFilePencil,
  IconQrcode, IconSearch, IconUsersGroup,
} from "@tabler/icons-react";

/**
 * O que cada destaque vira na tela.
 *
 * O servidor decide **qual** destaque aparece (a prioridade é regra de
 * negócio); aqui ficam só o ícone, o rótulo do botão e para onde ele leva.
 * `destino` recebe o destaque inteiro porque alguns levam o id da atividade.
 */
export const DESTAQUE_DO_ESTUDANTE = {
  checkin_disponivel: {
    icone: IconQrcode, cor: "clay", rotulo: "Fazer check-in",
    destino: () => "/check-in",
  },
  evento_hoje: {
    icone: IconCalendarEvent, cor: "brand", rotulo: "Ver minha inscrição",
    destino: () => "/minhas-inscricoes",
  },
  certificado_novo: {
    icone: IconCertificate, cor: "brand", rotulo: "Ver certificados",
    destino: () => "/meus-certificados",
  },
  nenhum: {
    icone: IconSearch, cor: "brand", rotulo: "Buscar atividades",
    destino: () => "/atividades",
  },
};

export const DESTAQUE_DA_ONG = {
  checkin_disponivel: {
    icone: IconQrcode, cor: "clay", rotulo: "Abrir painel de check-in",
    destino: (d) => `/ong/atividades/${d.atividade.id}/check-in`,
  },
  validar_presencas: {
    icone: IconClipboardCheck, cor: "navy", rotulo: "Validar presenças",
    destino: (d) => `/ong/atividades/${d.atividade.id}/presencas`,
  },
  inscricoes_pendentes: {
    icone: IconUsersGroup, cor: "navy", rotulo: "Ver atividades",
    destino: () => "/ong/atividades",
  },
  rascunho_parado: {
    icone: IconFilePencil, cor: "navy", rotulo: "Ver rascunhos",
    destino: () => "/ong/atividades?aba=rascunho",
  },
  nenhum: {
    icone: IconCalendarEvent, cor: "brand", rotulo: "Criar atividade",
    destino: () => "/ong/atividades/nova",
  },
};
