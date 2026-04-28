export const GRAN_CONCEPCION_COMUNAS = [
  "CONCEPCION",
  "TALCAHUANO",
  "SAN PEDRO DE LA PAZ",
  "CHIGUAYANTE",
  "CORONEL",
  "LOTA",
  "HUALPEN",
  "PENCO",
  "TOME",
  "FLORIDA",
  "HUALQUI",
  "SANTA JUANA",
];

const ACCENTS: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  Á: "A",
  É: "E",
  Í: "I",
  Ó: "O",
  Ú: "U",
  ñ: "n",
  Ñ: "N",
};

export function normalizeComuna(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toUpperCase()
    .replace(/[áéíóúÁÉÍÓÚñÑ]/g, (m) => ACCENTS[m] ?? m);
}

export function isGranConcepcion(comuna: string | null | undefined): boolean {
  const n = normalizeComuna(comuna);
  return GRAN_CONCEPCION_COMUNAS.includes(n);
}
