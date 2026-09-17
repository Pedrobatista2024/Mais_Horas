/** Links do cabeçalho e do rodapé do portal. */
export const LINKS_DO_PORTAL = [
  { para: "/como-funciona", rotulo: "Como funciona" },
  { para: "/para-estudantes", rotulo: "Para estudantes" },
  { para: "/para-ongs", rotulo: "Para ONGs" },
  { para: "/ongs", rotulo: "ONGs parceiras" },
  { para: "/vagas", rotulo: "Vagas abertas" },
];

/** Cadastro com o perfil já escolhido (T8). */
export function cadastroComo(papel, volta) {
  const params = new URLSearchParams({ papel });
  if (volta) params.set("volta", volta);
  return `/criar-conta?${params}`;
}
