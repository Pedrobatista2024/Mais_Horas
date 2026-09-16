import { api } from "../services/api";

/**
 * Baixa um arquivo da API pelo axios, e não por `<a href>`.
 *
 * O link direto não levaria o access token — ele vive só em memória, nunca em
 * cookie ou localStorage (ver docs/autenticacao.md). Buscar como blob mantém a
 * autenticação e ainda deixa o erro da API legível para a tela.
 */
export async function baixarArquivo(caminho, nomePadrao = "arquivo.pdf") {
  let resposta;
  try {
    resposta = await api.get(caminho, { responseType: "blob" });
  } catch (erro) {
    // O corpo do erro também veio como blob; sem converter, a mensagem da API
    // se perderia e a tela mostraria só "falhou".
    const blob = erro?.response?.data;
    if (blob instanceof Blob) {
      try {
        erro.response.data = JSON.parse(await blob.text());
      } catch {
        /* corpo não era JSON: segue o erro original */
      }
    }
    throw erro;
  }

  const disposicao = resposta.headers?.["content-disposition"] || "";
  const nome = /filename="?([^";]+)"?/i.exec(disposicao)?.[1] || nomePadrao;

  const url = URL.createObjectURL(resposta.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
