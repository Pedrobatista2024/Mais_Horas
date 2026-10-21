/**
 * As seis situações de uma atividade (RN-54).
 *
 * `em_andamento` e `aguardando_validacao` não existem no banco — vêm calculadas
 * pelo servidor a partir do horário. Aqui são situações como as outras.
 *
 * As cores evitam o âmbar, que na interface é exclusivo da carga horária.
 *
 * Mora fora do componente porque exportar constante ao lado de componente
 * quebra o recarregamento rápido do Vite.
 */
export const SITUACOES = {
  rascunho: { rotulo: "Rascunho", cor: "gray" },
  publicada: { rotulo: "Publicada", cor: "brand" },
  em_andamento: { rotulo: "Acontecendo agora", cor: "green" },
  aguardando_validacao: { rotulo: "A validar", cor: "violet" },
  finalizada: { rotulo: "Finalizada", cor: "teal" },
  cancelada: { rotulo: "Cancelada", cor: "red" },
};
