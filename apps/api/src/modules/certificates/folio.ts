import crypto from "node:crypto";

// Folio público de receta: RX-AAAA-NNNNNN-XXXX.
//   - NNNNNN: correlativo interno (auditoría legal, secuencial).
//   - XXXX: sufijo aleatorio para que el folio NO sea enumerable/scrapeable
//     (sin el azar, alguien podría adivinar el siguiente correlativo).
// Alfabeto Crockford base32 (sin I/L/O/U → no se confunden al leerlo en papel).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function randomSuffix(len = 4): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function buildFolio(seq: number, year: number): string {
  return `RX-${year}-${String(seq).padStart(6, "0")}-${randomSuffix(4)}`;
}
