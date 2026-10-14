import { IconBrandGithub } from "@tabler/icons-react";

import { IconeGoogle, IconeMicrosoft } from "./IconesProvedores";

/**
 * Provedores de entrada externa, na ordem em que os botões aparecem (D41).
 *
 * Quais aparecem quem decide é o servidor, em `/auth/provedores`: sem
 * credencial configurada, o botão daquele provedor não existe.
 *
 * Mora fora do componente porque constante exportada ao lado de componente
 * quebra o recarregamento rápido do Vite.
 */
export const PROVEDORES = [
  { chave: "google", nome: "Google", artigo: "o", icone: IconeGoogle },
  { chave: "microsoft", nome: "Microsoft", artigo: "a", icone: IconeMicrosoft },
  { chave: "github", nome: "GitHub", artigo: "o", icone: IconBrandGithub },
];

// Quando a URL traz um provedor que não conhecemos, o texto continua correto.
const DESCONHECIDO = { chave: "", nome: "provedor", artigo: "o", icone: null };

export function provedorPorChave(chave) {
  return PROVEDORES.find((p) => p.chave === chave) ?? null;
}

export function provedorOuGenerico(chave) {
  return provedorPorChave(chave) ?? DESCONHECIDO;
}

/** "com o Google", "com a Microsoft". */
export function comArtigo(p) {
  return `com ${p.artigo} ${p.nome}`;
}

/** "pelo Google", "pela Microsoft". */
export function pelo(p) {
  return `${p.artigo === "a" ? "pela" : "pelo"} ${p.nome}`;
}

/** "O Google", "A Microsoft" — para começo de frase. */
export function sujeito(p) {
  return `${p.artigo.toUpperCase()} ${p.nome}`;
}
