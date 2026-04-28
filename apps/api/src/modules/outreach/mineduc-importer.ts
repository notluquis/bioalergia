import { db } from "@finanzas/db";
import Papa from "papaparse";
import { GRAN_CONCEPCION_COMUNAS, normalizeComuna } from "./comunas";
import { mapDependencia } from "./dependencia";

export const MINEDUC_DEFAULT_URL =
  "https://datosabiertos.mineduc.cl/wp-content/uploads/2024/08/20240201_Directorio_Establecimientos_Educacionales.csv";

const COLUMN_ALIASES: Record<string, string[]> = {
  rbd: ["RBD"],
  nombre: ["NOM_RBD", "NOMBRE"],
  comuna: ["NOM_COM_RBD", "COMUNA"],
  region: ["NOM_REG_RBD_A", "REGION"],
  codDepe2: ["COD_DEPE2"],
  telefono: ["TELEFONO"],
  email: ["MAIL", "CORREO"],
  director: ["NOMBRE_DIRECTOR", "DIRECTOR"],
  estado: ["ESTADO_ESTAB"],
  rural: ["RURAL_RBD"],
  matricula: ["MATRICULA_TOTAL"],
  direccion: ["DIRECC_RBD", "DIRECCION"],
};

function pickColumn(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) {
    if (row[alias] != null && row[alias] !== "") return row[alias];
  }
  return "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v || !EMAIL_RE.test(v)) return null;
  return v;
}

function cleanInt(raw: string): number | null {
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

export type ImportOptions = {
  source: "url" | "upload";
  url?: string;
  csvText?: string;
  comunas?: string[];
  dryRun?: boolean;
  createdByUserId?: number | null;
};

export type ImportResult = {
  totalRows: number;
  filteredRows: number;
  nuevos: number;
  actualizados: number;
  inactivos: number;
  errores: number;
  errorDetalle: string | null;
  logId?: number;
};

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch MINEDUC falló: ${res.status} ${res.statusText}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const decoder = new TextDecoder("latin1");
  return decoder.decode(buf);
}

export async function importMineducDataset(opts: ImportOptions): Promise<ImportResult> {
  const log = await db.outreachImportLog.create({
    data: {
      source: opts.source,
      fileUrl: opts.source === "url" ? opts.url ?? MINEDUC_DEFAULT_URL : null,
      createdByUserId: opts.createdByUserId ?? null,
    },
  });

  try {
    let csvText: string;
    if (opts.source === "url") {
      csvText = await fetchCsv(opts.url ?? MINEDUC_DEFAULT_URL);
    } else {
      if (!opts.csvText) throw new Error("CSV vacío");
      csvText = opts.csvText;
    }

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
    });

    const targetComunas = (opts.comunas?.length ? opts.comunas : GRAN_CONCEPCION_COMUNAS).map(
      normalizeComuna,
    );

    const rows = parsed.data;
    let nuevos = 0;
    let actualizados = 0;
    let errores = 0;
    let filteredRows = 0;
    const seenRbds = new Set<string>();

    for (const row of rows) {
      try {
        const rbd = pickColumn(row, COLUMN_ALIASES.rbd).trim();
        if (!rbd) continue;
        const comunaRaw = pickColumn(row, COLUMN_ALIASES.comuna);
        const comunaNorm = normalizeComuna(comunaRaw);
        if (!targetComunas.includes(comunaNorm)) continue;
        filteredRows += 1;
        seenRbds.add(rbd);

        const data = {
          nombre: pickColumn(row, COLUMN_ALIASES.nombre).trim() || `RBD ${rbd}`,
          dependencia: mapDependencia(pickColumn(row, COLUMN_ALIASES.codDepe2)),
          comuna: comunaNorm,
          region: pickColumn(row, COLUMN_ALIASES.region).trim() || "",
          direccion: pickColumn(row, COLUMN_ALIASES.direccion).trim() || null,
          telefonoMineduc: pickColumn(row, COLUMN_ALIASES.telefono).trim() || null,
          emailMineduc: cleanEmail(pickColumn(row, COLUMN_ALIASES.email)),
          directorMineduc: pickColumn(row, COLUMN_ALIASES.director).trim() || null,
          matriculaTotal: cleanInt(pickColumn(row, COLUMN_ALIASES.matricula)),
          rural: pickColumn(row, COLUMN_ALIASES.rural).trim() === "1",
          activo: pickColumn(row, COLUMN_ALIASES.estado).trim() === "1",
        };

        if (opts.dryRun) continue;

        const existing = await db.outreachEstablishment.findUnique({ where: { rbd } });
        if (existing) {
          await db.outreachEstablishment.update({
            where: { rbd },
            data: {
              nombre: data.nombre,
              dependencia: data.dependencia,
              comuna: data.comuna,
              region: data.region,
              direccion: data.direccion,
              telefonoMineduc: data.telefonoMineduc,
              emailMineduc: data.emailMineduc,
              directorMineduc: data.directorMineduc,
              matriculaTotal: data.matriculaTotal,
              rural: data.rural,
              activo: data.activo,
            },
          });
          actualizados += 1;
        } else {
          await db.outreachEstablishment.create({
            data: { rbd, ...data },
          });
          nuevos += 1;
        }
      } catch {
        errores += 1;
      }
    }

    let inactivos = 0;
    if (!opts.dryRun && seenRbds.size > 0) {
      const all = await db.outreachEstablishment.findMany({
        where: {
          activo: true,
          comuna: { in: targetComunas },
        },
        select: { rbd: true },
      });
      const missing = all.filter((e) => !seenRbds.has(e.rbd)).map((e) => e.rbd);
      if (missing.length > 0) {
        const upd = await db.outreachEstablishment.updateMany({
          where: { rbd: { in: missing } },
          data: { activo: false },
        });
        inactivos = upd.count ?? missing.length;
      }
    }

    const result: ImportResult = {
      totalRows: rows.length,
      filteredRows,
      nuevos,
      actualizados,
      inactivos,
      errores,
      errorDetalle: null,
      logId: log.id,
    };

    await db.outreachImportLog.update({
      where: { id: log.id },
      data: {
        totalRows: rows.length,
        nuevos,
        actualizados,
        inactivos,
        errores,
        finishedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    await db.outreachImportLog.update({
      where: { id: log.id },
      data: { errorDetalle: msg, finishedAt: new Date() },
    });
    throw error;
  }
}
