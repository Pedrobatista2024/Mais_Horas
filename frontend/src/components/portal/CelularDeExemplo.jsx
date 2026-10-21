/**
 * Um celular com uma tela de verdade do app dentro.
 *
 * A tela é uma captura do sistema rodando (390×844, em 2x), não um desenho: o
 * que aparece aqui é o que o aluno vê. A moldura imita um iPhone atual —
 * Dynamic Island, barra de status, botões laterais e indicador de início — e
 * tudo é medido em `cqw` (porcentagem da largura do próprio celular), então a
 * proporção se mantém em qualquer tamanho.
 */
export default function CelularDeExemplo({ tela, alt, hora = "9:41", largura = 260 }) {
  return (
    <figure className="mh-iphone" style={{ "--largura": `${largura}px` }}>
      <div className="mh-iphone-corpo">
        <span className="mh-iphone-botao mh-iphone-acao" aria-hidden="true" />
        <span className="mh-iphone-botao mh-iphone-volume" aria-hidden="true" />
        <span className="mh-iphone-botao mh-iphone-volume mh-iphone-volume-2" aria-hidden="true" />
        <span className="mh-iphone-botao mh-iphone-lateral" aria-hidden="true" />
        <div className="mh-iphone-tela">
          <div className="mh-iphone-status" aria-hidden="true">
            <span>{hora}</span>
            <span className="mh-iphone-icones">
              <svg viewBox="0 0 18 12" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="0.8" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="0.8" />
                <rect x="10" y="3" width="3" height="9" rx="0.8" />
                <rect x="15" y="0" width="3" height="12" rx="0.8" />
              </svg>
              <svg viewBox="0 0 16 12" fill="currentColor">
                <path d="M8 2.4c2.3 0 4.4.9 6 2.4l1.2-1.3A10.4 10.4 0 0 0 8 .6 10.4 10.4 0 0 0 .8 3.5L2 4.8a8.6 8.6 0 0 1 6-2.4Z" />
                <path d="M8 5.9c1.4 0 2.6.5 3.6 1.4l1.2-1.3A7 7 0 0 0 8 4.1 7 7 0 0 0 3.2 6l1.2 1.3A5.2 5.2 0 0 1 8 5.9Z" />
                <path d="M8 9.3c.5 0 .9.2 1.3.5L8 11.2 6.7 9.8c.4-.3.8-.5 1.3-.5Z" />
              </svg>
              <svg viewBox="0 0 27 12" fill="none">
                <rect x="0.5" y="0.5" width="22" height="11" rx="3.2" stroke="currentColor" opacity="0.4" />
                <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
                <path d="M24.5 4v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2Z" fill="currentColor" opacity="0.45" />
              </svg>
            </span>
          </div>
          <div className="mh-iphone-ilha" aria-hidden="true" />
          <img src={tela} alt={alt} width={780} height={1688} loading="lazy" />
          <div className="mh-iphone-inicio" aria-hidden="true" />
        </div>
      </div>
    </figure>
  );
}
