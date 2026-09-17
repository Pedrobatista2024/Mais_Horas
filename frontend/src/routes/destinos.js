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

/**
 * Destino pedido em `?volta=`, se for um caminho **deste** site.
 *
 * Sem a checagem, um link como `/entrar?volta=https://golpe.com` levaria a
 * pessoa, recém-logada e confiante, para fora daqui.
 */
export function destinoSeguro(valor) {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) {
    return null;
  }
  return valor;
}
