import { useEffect } from "react";

/** Título da aba do navegador: o da página primeiro, a marca depois. */
export function useTitulo(titulo) {
  useEffect(() => {
    if (typeof titulo !== "string" || !titulo) return undefined;
    const anterior = document.title;
    document.title = `${titulo} – Mais Horas`;
    return () => { document.title = anterior; };
  }, [titulo]);
}

export default useTitulo;
