import { useEffect, useState } from "react";

import { api } from "../services/api";

/**
 * GET de uma vitrine pública do portal. Devolve os dados, ou `null` enquanto
 * carrega e quando falha.
 *
 * Falha em silêncio de propósito: o visitante da página inicial não precisa de
 * toast de erro — sem os dados, a seção que depende deles simplesmente não
 * aparece. `url` já leva a query string, para a dependência ser só um texto.
 */
export function useConsultaPublica(url) {
  const [resultado, setResultado] = useState({ url: null, dados: null });

  useEffect(() => {
    let ativo = true;
    api.get(url)
      .then(({ data }) => { if (ativo) setResultado({ url, dados: data }); })
      .catch(() => { if (ativo) setResultado({ url, dados: null }); });
    return () => { ativo = false; };
  }, [url]);

  // Resultado de outra URL (navegação rápida) não vale para esta.
  return resultado.url === url ? resultado.dados : null;
}

export default useConsultaPublica;
