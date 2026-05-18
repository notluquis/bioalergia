// Sesión Haulmer unificada — UN SOLO cache de JWT compartido entre ingest
// DTE y emisión DTE. Evita logins paralelos que invaliden la sesión activa
// en Keycloak (Lucas 2026-05-17).
//
// Llamadores actuales:
//   - services/haulmer-service.ts (ingest CSV/XML)
//   - modules/haulmer/xml-service.ts (download DTE XMLs)
//   - modules/haulmer/emit-dte.ts (POST emit boleta/factura)
//
// Re-login solo cuando isJWTExpired(token.expiresAt) === true, con un
// safety margin de 60s para evitar uso de tokens en el borde.

import { captureHaulmerJWT, type HaulmerConfig, isJWTExpired } from "./auth.ts";

type Cached = {
  token: string;
  expiresAt: Date;
  configKey: string;
};

let cached: Cached | null = null;
let inFlight: Promise<Cached> | null = null;

function configKeyOf(c: HaulmerConfig): string {
  // Distintos usuarios = distintos caches. Misma combinación reutiliza.
  return `${c.email}::${c.password.slice(0, 4)}`;
}

function readEnvConfig(): HaulmerConfig {
  const email = process.env.HAULMER_EMAIL;
  const password = process.env.HAULMER_PASSWORD;
  const rut = process.env.HAULMER_RUT;
  if (!email || !password || !rut) {
    throw new Error(
      "[haulmer-session] HAULMER_EMAIL/HAULMER_PASSWORD/HAULMER_RUT no configurados"
    );
  }
  return { email, password, rut };
}

/**
 * Obtiene JWT cacheado; re-loguea si expira o si cambia credenciales.
 * Si no se pasa `config`, lee de env.
 */
export async function getHaulmerJwt(config?: HaulmerConfig): Promise<string> {
  const effective = config ?? readEnvConfig();
  const key = configKeyOf(effective);

  // Cache hit válido + mismo config.
  if (
    cached &&
    cached.configKey === key &&
    !isJWTExpired(cached.expiresAt)
  ) {
    return cached.token;
  }

  // Coalesce concurrent refreshes — si ya hay uno en vuelo, espera ese.
  if (inFlight) {
    const result = await inFlight;
    if (result.configKey === key && !isJWTExpired(result.expiresAt)) {
      return result.token;
    }
  }

  inFlight = (async () => {
    const response = await captureHaulmerJWT(effective);
    cached = {
      token: response.jwtToken,
      expiresAt: response.expiresAt,
      configKey: key,
    };
    return cached;
  })();

  try {
    const fresh = await inFlight;
    return fresh.token;
  } finally {
    inFlight = null;
  }
}

/** Forzar re-login (post-401 desde ML/Haulmer API). */
export function invalidateHaulmerSession(): void {
  cached = null;
}

/** Para tests. */
export function _resetHaulmerSessionForTest(): void {
  cached = null;
  inFlight = null;
}
