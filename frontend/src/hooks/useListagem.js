import { useCallback, useEffect, useState } from "react";

import { api, mensagemDoErro } from "../services/api";
import { notifyError } from "../utils/notify";

const VAZIA = { itens: [], total: 0, pagina: 1, paginas: 0 };

/**
 * GET paginado com filtros do servidor (padrão `Pagina` da API).
 *
 * `params` precisa ser estável entre renderizações — passe um objeto vindo de
 * `useMemo` —, senão a consulta repete a cada render.
 */
export function useListagem(url, params) {
  const [dados, setDados] = useState(VAZIA);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let ativo = true;
    api.get(url, { params })
      .then(({ data }) => { if (ativo) setDados(data); })
      .catch((erro) => {
        if (ativo) notifyError(mensagemDoErro(erro, "Não foi possível carregar a lista"));
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [url, params, versao]);

  return { dados, carregando, recarregar };
}

export default useListagem;
