/**
 * Avisa o sino de que a contagem mudou fora dele.
 *
 * A página de notificações e o sino não compartilham estado; sem este sinal,
 * "marcar todas" na página deixava o sino exibindo o número antigo até a
 * próxima troca de tela.
 */
export const AVISOS_MUDARAM = "mh:avisos-mudaram";

export function avisarQueAvisosMudaram() {
  window.dispatchEvent(new Event(AVISOS_MUDARAM));
}
