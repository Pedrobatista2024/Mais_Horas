import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { notifyError } from "../utils/notify";

/**
 * Hook minimalista para GET com estado de loading/erro e refetch.
 * Ex.: const { data, loading, refetch } = useFetch("/activities");
 */
export function useFetch(url, { auto = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      setData(res.data);
      return res.data;
    } catch (err) {
      setError(err);
      notifyError(err, "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (auto) refetch();
  }, [auto, refetch]);

  return { data, loading, error, refetch, setData };
}

export default useFetch;
