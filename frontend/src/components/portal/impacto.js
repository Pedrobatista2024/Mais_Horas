/** Os números do portal, na ordem em que aparecem. Rótulo: [singular, plural]. */
export const NUMEROS_DE_IMPACTO = [
  { chave: "horasCertificadas", rotulo: ["hora certificada", "horas certificadas"] },
  { chave: "certificadosEmitidos", rotulo: ["certificado emitido", "certificados emitidos"] },
  { chave: "atividadesRealizadas", rotulo: ["atividade realizada", "atividades realizadas"] },
  { chave: "ongs", rotulo: ["organização", "organizações"] },
  { chave: "estudantes", rotulo: ["estudante", "estudantes"] },
];

/** Só os números maiores que zero: "0 horas" na vitrine depõe contra. */
export function numerosVisiveis(resumo) {
  return NUMEROS_DE_IMPACTO.filter((n) => (resumo?.[n.chave] ?? 0) > 0);
}
