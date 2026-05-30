import API_BASE_URL from "../config/api";

/** Formata uma data ISO para dd/mm/aaaa (pt-BR). */
export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

/**
 * Resolve a URL de uma imagem de perfil.
 * - photoUrl (http) → usa direto
 * - photo (caminho salvo no backend) → prefixa com a origem da API
 */
export function resolveImage(photo, photoUrl) {
  if (photoUrl && /^https?:\/\//i.test(photoUrl)) return photoUrl;
  if (!photo) return null;
  if (/^https?:\/\//i.test(photo)) return photo;
  const normalized = String(photo).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${API_BASE_URL}/${normalized}`;
}

/** Iniciais de um nome para avatares. */
export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}
