/**
 * Para onde cada papel vai depois de entrar.
 *
 * Mora fora do AuthContext porque exportar constante ao lado de componente
 * quebra o recarregamento rápido do Vite.
 */
export const PAINEL_POR_PAPEL = {
  estudante: "/painel",
  ong: "/ong",
  superadmin: "/admin",
};

export function painelDe(papel) {
  return PAINEL_POR_PAPEL[papel] || "/painel";
}
