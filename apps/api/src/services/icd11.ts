// WHO ICD-11 (CIE-11) cloud API token — UN SOLO cache de access_token compartido
// para todas las llamadas del ECT widget. Evita pedir un token nuevo por
// cada `getNewTokenFunction` del frontend (espeja patrón haulmer/session.ts).
//
// OAuth2 client-credentials contra https://icdaccessmanagement.who.int/connect/token
// Registro gratis: https://icd.who.int/icdapi -> View API access key.
//
// El client_secret NUNCA llega al browser: el widget pide el token a nuestra
// ruta authed `GET /api/icd11/token`, que delega aquí.

const TOKEN_ENDPOINT = "https://icdaccessmanagement.who.int/connect/token";
const SCOPE = "icdapi_access";
// Margen de seguridad: refrescamos 60s antes del expiry real para no usar un
// token en el borde.
const EXPIRY_MARGIN_MS = 60_000;

type CachedToken = {
  token: string;
  expiresAt: number; // epoch ms
};

let cached: CachedToken | null = null;
let inFlight: Promise<CachedToken> | null = null;

function readCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.ICD_API_CLIENT_ID;
  const clientSecret = process.env.ICD_API_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("[icd11] ICD_API_CLIENT_ID/ICD_API_CLIENT_SECRET no configurados");
  }
  return { clientId, clientSecret };
}

async function requestToken(): Promise<CachedToken> {
  const { clientId, clientSecret } = readCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: SCOPE,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`[icd11] token request failed: ${response.status} ${detail.slice(0, 200)}`);
  }

  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("[icd11] token response missing access_token");
  }
  const expiresInMs = (json.expires_in ?? 3600) * 1000;
  return {
    token: json.access_token,
    expiresAt: Date.now() + expiresInMs - EXPIRY_MARGIN_MS,
  };
}

/** Devuelve un access_token válido para el ICD-11 API, cacheado en memoria. */
export async function getIcd11Token(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // Coalesce: si ya hay un refresh en vuelo, espera ese.
  if (inFlight) {
    const result = await inFlight;
    if (result.expiresAt > Date.now()) return result.token;
  }

  inFlight = (async () => {
    const fresh = await requestToken();
    cached = fresh;
    return fresh;
  })();

  try {
    const fresh = await inFlight;
    return fresh.token;
  } finally {
    inFlight = null;
  }
}
