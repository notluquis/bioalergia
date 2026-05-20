// Test throwaway: logueás A MANO en Essbio (captcha lo resolvés vos como humano),
// y el script reusa esa sesión autenticada para leer facturacion + corteNoPago.
//
// Correr LOCAL:
//   ESSBIO_ID_SERVICIO=677471 ESSBIO_NUM_SERVICIO=60332447 node apps/api/scripts/essbio-login-test.mjs
// (sin password — la tipeás en el browser)

import { chromium } from "playwright";
import { rmSync } from "node:fs";

const ID_SERVICIO = process.env.ESSBIO_ID_SERVICIO ?? "677471";
const NUM_SERVICIO = process.env.ESSBIO_NUM_SERVICIO ?? "60332447";
const PROFILE = `/tmp/essbio-pw-${Date.now()}`;

console.log("→ limpiando perfiles viejos + lanzando chromium headful...");
try {
  rmSync("/tmp/essbio-pw-profile", { recursive: true, force: true });
} catch {
  /* ignore */
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 800 },
});
console.log("→ chromium abierto. Ventana debería ser visible.");
const page = ctx.pages()[0] ?? (await ctx.newPage());

console.log("→ abriendo essbio.cl ...");
await page.goto("https://www.essbio.cl/", { waitUntil: "domcontentloaded", timeout: 60000 });

console.log("\n========================================");
console.log("  Logueate a MANO en la ventana del browser.");
console.log("  El script detecta tu sesión solo (poll cada 3s).");
console.log("========================================\n");

// Poll loginJson hasta que la sesión esté autenticada (aparece rutUsuario)
const headers = {
  "X-Requested-With": "XMLHttpRequest",
  HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
};
let logged = false;
for (let i = 0; i < 100; i++) {
  const probe = await page.evaluate(async (h) => {
    const r = await fetch("/loginJson", { method: "POST", headers: h });
    return r.text();
  }, headers);
  if (probe.includes("rutUsuario")) {
    console.log("→ sesión detectada ✓");
    logged = true;
    break;
  }
  await page.waitForTimeout(3000);
}
if (!logged) {
  console.log("⏱ timeout: no detecté login en 5min. Cerrando.");
  await ctx.close();
  process.exit(0);
}

console.log("→ sesión lista, esperando que asiente la página...");
await page.waitForLoadState("domcontentloaded").catch(() => {});
await page.waitForTimeout(4000);

console.log("→ consultando con tu sesión...");
async function evalWithRetry(fn, arg) {
  for (let i = 0; i < 5; i++) {
    try {
      return await page.evaluate(fn, arg);
    } catch (e) {
      if (String(e).includes("context was destroyed") || String(e).includes("navigation")) {
        await page.waitForTimeout(2000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("evaluate falló tras reintentos (navegación constante)");
}
const result = await evalWithRetry(
  async ({ ID_SERVICIO, NUM_SERVICIO }) => {
    const headers = {
      "X-Requested-With": "XMLHttpRequest",
      HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
    };

    // facturacion (historial consumo+monto+lectura)
    const fd = new FormData();
    fd.append("id_servicio", ID_SERVICIO);
    fd.append("numero_servicio", NUM_SERVICIO);
    fd.append("info", "SI");
    fd.append("emp", "essbio");
    const r = await fetch("/getDatos/facturacion", { method: "POST", headers, body: fd });
    const fac = await r.text();

    // corte por no pago
    const fd2 = new FormData();
    fd2.append("numero_servicio", NUM_SERVICIO);
    const r2 = await fetch("/corteNoPago", { method: "POST", headers, body: fd2 });
    const corte = await r2.text();

    // loginJson (qué servicios tiene la sesión + idservicio)
    const r3 = await fetch("/loginJson", { method: "POST", headers });
    const loginJson = await r3.text();

    return {
      facturacion: { status: r.status, body: fac.slice(0, 1200) },
      corte: { status: r2.status, body: corte.slice(0, 200) },
      loginJson: { status: r3.status, body: loginJson.slice(0, 600) },
    };
  },
  { ID_SERVICIO, NUM_SERVICIO }
);

console.log(JSON.stringify(result, null, 2));
await ctx.close();
