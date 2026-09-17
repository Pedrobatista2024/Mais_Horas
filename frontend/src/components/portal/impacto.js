import {
  IconBuildingCommunity, IconCalendarCheck, IconCertificate, IconClockHour4,
  IconSchool,
} from "@tabler/icons-react";

export const NUMEROS_DE_IMPACTO = [
  { chave: "horasCertificadas", rotulo: ["hora certificada", "horas certificadas"], icone: IconClockHour4, cor: "brand" },
  { chave: "certificadosEmitidos", rotulo: ["certificado emitido", "certificados emitidos"], icone: IconCertificate, cor: "clay" },
  { chave: "atividadesRealizadas", rotulo: ["atividade realizada", "atividades realizadas"], icone: IconCalendarCheck, cor: "navy" },
  { chave: "ongs", rotulo: ["organização", "organizações"], icone: IconBuildingCommunity, cor: "navy" },
  { chave: "estudantes", rotulo: ["estudante", "estudantes"], icone: IconSchool, cor: "brand" },
];

/** Só os números maiores que zero: "0 horas" na vitrine depõe contra. */
export function numerosVisiveis(resumo) {
  return NUMEROS_DE_IMPACTO.filter((n) => (resumo?.[n.chave] ?? 0) > 0);
}
