// Genera los lookups compactos CIE-10 ↔ CIE-11 desde los archivos oficiales WHO
// (crosswalk "MapToOneCategory", descargables de icd.who.int/dev11/downloads →
// mapping.zip). Regenerar cuando WHO publique un release nuevo.
//
// Uso:
//   node apps/intranet/scripts/gen-icd-maps.mjs /ruta/a/carpeta/mapping
//
// Salida → src/features/certificates/data/{icd11-to-icd10,icd10-to-icd11}.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = process.argv[2];
if (!SRC) {
  console.error("Falta la ruta a la carpeta mapping. Uso: node gen-icd-maps.mjs <carpeta>");
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "../src/features/certificates/data");
mkdirSync(OUT, { recursive: true });

function rows(file) {
  const txt = readFileSync(join(SRC, file), "utf8").replace(/^﻿/, "");
  return txt
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(1)
    .map((line) => line.split("\t"));
}

// 11To10: [URI, icd11Code, icd11Chapter, icd11Title, icd10Code, ...]
const icd11To10 = {};
for (const r of rows("11To10MapToOneCategory.txt")) {
  const icd11 = (r[1] || "").trim();
  const icd10 = (r[4] || "").trim();
  if (icd11 && icd10 && !(icd11 in icd11To10)) icd11To10[icd11] = icd10;
}
writeFileSync(join(OUT, "icd11-to-icd10.json"), JSON.stringify(icd11To10));

// 10To11: [..., icd10Code(2), ..., FoundationURI(7), LinURI(8), icd11Code(9), icd11Chapter(10), icd11Title(11)]
const icd10To11 = {};
for (const r of rows("10To11MapToOneCategory.txt")) {
  const icd10 = (r[2] || "").trim();
  const icd11 = (r[9] || "").trim();
  const title = (r[11] || "").trim();
  if (icd10 && icd11 && !(icd10 in icd10To11)) icd10To11[icd10] = { c: icd11, t: title };
}
writeFileSync(join(OUT, "icd10-to-icd11.json"), JSON.stringify(icd10To11));

console.log(
  `icd11-to-icd10: ${Object.keys(icd11To10).length} · icd10-to-icd11: ${Object.keys(icd10To11).length}`
);
