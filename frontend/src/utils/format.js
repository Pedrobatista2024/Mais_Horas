import API_BASE_URL from "../config/api";

/**
 * Formata uma data ISO para dd/mm/aaaa (pt-BR).
 *
 * "2026-09-13" sozinho é lido pelo JavaScript como meia-noite **UTC**, que no
 * Brasil (UTC-3) cai no dia anterior. Por isso a data pura é montada campo a
 * campo, em horário local: senão toda atividade apareceria um dia antes.
 */
export function formatDate(value) {
  if (!value) return "-";

  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = soData
    ? new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]))
    : new Date(value);

  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

/** "sexta-feira, 13 de setembro" — para o cabeçalho do detalhe. */
export function formatDateLong(value) {
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!soData) return formatDate(value);
  const d = new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3]));
  return d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
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
