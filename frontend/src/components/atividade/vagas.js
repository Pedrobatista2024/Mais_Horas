/** Quantas vagas sobram, em texto de gente. Fora do componente pelo Vite. */
export function textoDeVagas({ lotada, vagasRestantes, vagasMax }) {
  if (lotada) return "Lotada";
  if (vagasRestantes === 1) return "Última vaga";
  return `${vagasRestantes} de ${vagasMax} vagas livres`;
}
