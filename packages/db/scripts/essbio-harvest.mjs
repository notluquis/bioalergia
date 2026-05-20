// Essbio harvester — login headless automático (reCAPTCHA v3 lo pasa el browser
// sin humano) + harvest facturación/corte + persiste snapshots en DB.
//
// Correr desde packages/db (pg + playwright resuelven acá):
//   cd packages/db
//   ESSBIO_RUT=202759955 ESSBIO_PASS='clave' node scripts/essbio-harvest.mjs
//
// Defaults para la cuenta actual (id=1). Override por env.

import { chromium } from "playwright";
import pg from "pg";
import { readFileSync } from "node:fs";

const RUT = process.env.ESSBIO_RUT ?? "202759955"; // sin guión (formato que loguea)
const PASS = process.env.ESSBIO_PASS;
const ID_SERVICIO = process.env.ESSBIO_ID_SERVICIO ?? "677471";
const NUM_SERVICIO = process.env.ESSBIO_NUM_SERVICIO ?? "60332447";
const ACCOUNT_ID = Number(process.env.UTILITY_ACCOUNT_ID ?? "1");
const SITEKEY = "6Le9r_UaAAAAAAUCP7scmIRPCrcoL-hIargKYuZH";

if (!PASS) {
  console.error("Falta ESSBIO_PASS");
  process.exit(1);
}

function dbUrl() {
  const raw =
    process.env.DATABASE_URL ??
    readFileSync(new URL("../.env", import.meta.url), "utf8").match(
      /DATABASE_URL="?([^"\n]+)/
    )?.[1];
  if (!raw) throw new Error("DATABASE_URL no encontrada");
  return raw.replace(/\?.*$/, ""); // pg no traga ?pool_timeout=...
}

// "DD/MM/YYYY" → "YYYY-MM-DD"
function ddmmyyyyToISO(v) {
  const m = (v ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
// "MM/YYYY" → "YYYY-MM-01"
function periodToEmission(p) {
  const m = (p ?? "").trim().match(/^(\d{2})\/(\d{4})$/);
  return m ? `${m[2]}-${m[1]}-01` : null;
}

// ─── 1) Login headless + harvest ─────────────────────────────────────────────
console.log("→ login headless en essbio.cl ...");
const ctx = await chromium.launchPersistentContext("/tmp/essbio-harvest-profile", {
  headless: true,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://www.essbio.cl/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.addScriptTag({ url: `https://www.google.com/recaptcha/api.js?render=${SITEKEY}` });
await page.waitForFunction(() => window.grecaptcha?.execute, { timeout: 15000 });
await page.waitForTimeout(2000);

const harvest = await page.evaluate(
  async ({ RUT, PASS, SITEKEY, ID_SERVICIO, NUM_SERVICIO }) => {
    const headers = {
      "X-Requested-With": "XMLHttpRequest",
      HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
    };
    const token = await window.grecaptcha.execute(SITEKEY, { action: "login" });
    const lf = new FormData();
    lf.append("rut", RUT);
    lf.append("password", PASS);
    lf.append("rcToken", token);
    const lr = await fetch("/login", { method: "POST", headers, body: lf });
    const loginBody = await lr.text();
    let lp;
    try {
      lp = JSON.parse(loginBody);
    } catch {
      lp = null;
    }
    if (!lp || String(lp.respuesta) !== "0") {
      return { ok: false, loginBody };
    }

    const ff = new FormData();
    ff.append("id_servicio", ID_SERVICIO);
    ff.append("numero_servicio", NUM_SERVICIO);
    ff.append("info", "SI");
    ff.append("emp", "essbio");
    const fr = await fetch("/getDatos/facturacion", { method: "POST", headers, body: ff });
    const facturacion = await fr.json();

    const cf = new FormData();
    cf.append("numero_servicio", NUM_SERVICIO);
    const cr = await fetch("/corteNoPago", { method: "POST", headers, body: cf });
    const corte = await cr.json();

    return { ok: true, facturacion, corte };
  },
  { RUT, PASS, SITEKEY, ID_SERVICIO, NUM_SERVICIO }
);
await ctx.close();

if (!harvest.ok) {
  console.error("❌ login falló:", harvest.loginBody?.slice(0, 200));
  process.exit(1);
}
console.log("→ login OK, harvest:", harvest.facturacion?.length ?? 0, "boletas");

const rows = Array.isArray(harvest.facturacion) ? harvest.facturacion : [];
const dueDate = ddmmyyyyToISO(harvest.corte?.EFecha);

// ─── 2) Persistir snapshots ──────────────────────────────────────────────────
const client = new pg.Client(dbUrl());
await client.connect();

// set external_account_id si está null
await client.query(
  `UPDATE personal.utility_accounts SET external_account_id = $1 WHERE id = $2 AND external_account_id IS NULL`,
  [ID_SERVICIO, ACCOUNT_ID]
);

let imported = 0;
let skipped = 0;
// la boleta más reciente (primera del array) lleva la fecha de corte
let first = true;
for (const r of rows) {
  const folio = r.FOLIO;
  if (!folio) continue;
  const period = (r.FECFAC ?? "").trim();
  const res = await client.query(
    `INSERT INTO personal.utility_bill_snapshots
       (utility_account_id, source, current_amount, emission_date, due_date,
        period, folio, consumption, reading, raw_response)
     VALUES ($1,'ESSBIO_HISTORY',$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (utility_account_id, folio) WHERE folio IS NOT NULL DO NOTHING`,
    [
      ACCOUNT_ID,
      Number(r.TOTBOL ?? 0),
      periodToEmission(period),
      first ? dueDate : null,
      period,
      folio,
      Number(r.CONSUMO ?? 0),
      Number(r.LECTURA ?? 0),
      JSON.stringify(r),
    ]
  );
  if (res.rowCount > 0) imported++;
  else skipped++;
  first = false;
}

await client.end();
console.log(
  `✅ snapshots: ${imported} nuevas, ${skipped} ya existían (${rows.length} total). Corte: ${dueDate ?? "—"}`
);
