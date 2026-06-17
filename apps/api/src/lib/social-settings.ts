// Config de redes sociales en DB (no env). El flag dry-run vive en Setting
// `social.publishDryRun` y se administra desde la intranet. Fallback al env
// legacy SOCIAL_PUBLISH_DRYRUN y, por seguridad, default = true (no publica).
//
// La config de la Meta App (appId/appSecret/configId/graphVersion) también vive
// en Setting (keys `social.meta.*`). El appSecret se guarda ENCRIPTADO y NUNCA
// se devuelve al cliente — solo se desencripta server-side para el OAuth.

import { decryptSecret, encryptSecret } from "./secret-cipher.ts";
import { deleteSetting, getSetting, updateSetting } from "./settings.ts";

const DRYRUN_KEY = "social.publishDryRun";

const META_APP_ID_KEY = "social.meta.appId";
const META_APP_SECRET_KEY = "social.meta.appSecret";
const META_CONFIG_ID_KEY = "social.meta.configId";
const META_GRAPH_VERSION_KEY = "social.meta.graphVersion";

export const DEFAULT_GRAPH_VERSION = "v23.0";

/** true = simula (no publica a Meta). Orden: DB → env legacy → default true. */
export async function getSocialDryRun(): Promise<boolean> {
  const v = await getSetting(DRYRUN_KEY);
  if (v === "true") return true;
  if (v === "false") return false;
  return process.env.SOCIAL_PUBLISH_DRYRUN !== "false";
}

export async function setSocialDryRun(on: boolean): Promise<void> {
  await updateSetting(DRYRUN_KEY, on ? "true" : "false");
}

// ─── Meta App config ──────────────────────────────────────────────────────

/** Config pública de la Meta App (SIN appSecret) — segura para el cliente. */
export interface MetaAppPublicConfig {
  appId: string;
  configId: string;
  graphVersion: string;
  hasSecret: boolean;
}

/** Config completa server-side (appSecret desencriptado) para el OAuth. */
export interface MetaAppConfig extends MetaAppPublicConfig {
  appSecret: string;
}

/** Lee la config completa de la Meta App (appSecret desencriptado). Server-only. */
export async function getMetaAppConfig(): Promise<MetaAppConfig> {
  const [appId, appSecretEnc, configId, graphVersion] = await Promise.all([
    getSetting(META_APP_ID_KEY),
    getSetting(META_APP_SECRET_KEY),
    getSetting(META_CONFIG_ID_KEY),
    getSetting(META_GRAPH_VERSION_KEY),
  ]);
  const appSecret = decryptSecret(appSecretEnc) ?? "";
  return {
    appId: appId ?? "",
    appSecret,
    configId: configId ?? "",
    graphVersion: graphVersion || DEFAULT_GRAPH_VERSION,
    hasSecret: appSecret.length > 0,
  };
}

/** Lee la config pública (SIN appSecret) — para devolver al cliente. */
export async function getMetaAppPublicConfig(): Promise<MetaAppPublicConfig> {
  const full = await getMetaAppConfig();
  return {
    appId: full.appId,
    configId: full.configId,
    graphVersion: full.graphVersion,
    hasSecret: full.hasSecret,
  };
}

export interface SetMetaAppConfigInput {
  appId: string;
  /** Si viene vacío/undefined, se conserva el secret existente. */
  appSecret?: string;
  configId: string;
  graphVersion?: string;
}

/** Persiste la config de la Meta App. El appSecret se guarda encriptado. */
export async function setMetaAppConfig(input: SetMetaAppConfigInput): Promise<MetaAppPublicConfig> {
  await updateSetting(META_APP_ID_KEY, input.appId.trim());
  await updateSetting(META_CONFIG_ID_KEY, input.configId.trim());
  await updateSetting(META_GRAPH_VERSION_KEY, (input.graphVersion || DEFAULT_GRAPH_VERSION).trim());

  const secret = input.appSecret?.trim();
  if (secret) {
    await updateSetting(META_APP_SECRET_KEY, encryptSecret(secret));
  }

  return getMetaAppPublicConfig();
}

/** Borra el appSecret guardado (p.ej. al rotar credenciales). */
export async function clearMetaAppSecret(): Promise<void> {
  await deleteSetting(META_APP_SECRET_KEY).catch(() => undefined);
}

// ─── TikTok App config ────────────────────────────────────────────────────
// clientKey + clientSecret (encriptado) de la app de TikTok for Developers.

const TIKTOK_CLIENT_KEY_KEY = "social.tiktok.clientKey";
const TIKTOK_CLIENT_SECRET_KEY = "social.tiktok.clientSecret";

/** Config pública de la app de TikTok (SIN clientSecret) — segura para el cliente. */
export interface TiktokAppPublicConfig {
  clientKey: string;
  hasSecret: boolean;
}

/** Config completa server-side (clientSecret desencriptado) para el OAuth. */
export interface TiktokAppConfig extends TiktokAppPublicConfig {
  clientSecret: string;
}

/** Lee la config completa de la app de TikTok (clientSecret desencriptado). Server-only. */
export async function getTiktokConfig(): Promise<TiktokAppConfig> {
  const [clientKey, clientSecretEnc] = await Promise.all([
    getSetting(TIKTOK_CLIENT_KEY_KEY),
    getSetting(TIKTOK_CLIENT_SECRET_KEY),
  ]);
  const clientSecret = decryptSecret(clientSecretEnc) ?? "";
  return {
    clientKey: clientKey ?? "",
    clientSecret,
    hasSecret: clientSecret.length > 0,
  };
}

/** Lee la config pública (SIN clientSecret) — para devolver al cliente. */
export async function getTiktokPublicConfig(): Promise<TiktokAppPublicConfig> {
  const full = await getTiktokConfig();
  return { clientKey: full.clientKey, hasSecret: full.hasSecret };
}

export interface SetTiktokConfigInput {
  clientKey: string;
  /** Si viene vacío/undefined, se conserva el secret existente. */
  clientSecret?: string;
}

/** Persiste la config de la app de TikTok. El clientSecret se guarda encriptado. */
export async function setTiktokConfig(input: SetTiktokConfigInput): Promise<TiktokAppPublicConfig> {
  await updateSetting(TIKTOK_CLIENT_KEY_KEY, input.clientKey.trim());
  const secret = input.clientSecret?.trim();
  if (secret) {
    await updateSetting(TIKTOK_CLIENT_SECRET_KEY, encryptSecret(secret));
  }
  return getTiktokPublicConfig();
}

/** Borra el clientSecret guardado (p.ej. al rotar credenciales). */
export async function clearTiktokSecret(): Promise<void> {
  await deleteSetting(TIKTOK_CLIENT_SECRET_KEY).catch(() => undefined);
}

// ─── IA de imagen (hero opcional) ──────────────────────────────────────────
// Generación OPCIONAL de un hero/fondo fotográfico vía un modelo de imagen
// (Gemini "Nano Banana" por defecto, Recraft secundario). Pay-per-use; $0 si no
// se usa. El TEXTO de marca NUNCA lo genera la IA — se compone encima con Satori
// (evita typos/claims en una marca médica). Las API keys se guardan ENCRIPTADAS
// y NUNCA se devuelven al cliente (solo `hasGeminiKey`/`hasRecraftKey`).

export type AiImageProvider = "GEMINI" | "RECRAFT";

const AI_PROVIDER_KEY = "social.ai.provider";
const AI_GEMINI_KEY_KEY = "social.ai.geminiApiKey";
const AI_RECRAFT_KEY_KEY = "social.ai.recraftApiKey";

export const DEFAULT_AI_PROVIDER: AiImageProvider = "GEMINI";

/** Config pública de IA (SIN keys) — segura para el cliente. */
export interface AiImagePublicConfig {
  provider: AiImageProvider;
  hasGeminiKey: boolean;
  hasRecraftKey: boolean;
}

/** Config completa server-side (keys desencriptadas) para llamar al modelo. */
export interface AiImageConfig extends AiImagePublicConfig {
  geminiApiKey: string;
  recraftApiKey: string;
}

function normalizeProvider(v: string | null | undefined): AiImageProvider {
  return v === "RECRAFT" ? "RECRAFT" : DEFAULT_AI_PROVIDER;
}

/** Lee la config completa de IA (keys desencriptadas). Server-only. */
export async function getAiConfig(): Promise<AiImageConfig> {
  const [provider, geminiEnc, recraftEnc] = await Promise.all([
    getSetting(AI_PROVIDER_KEY),
    getSetting(AI_GEMINI_KEY_KEY),
    getSetting(AI_RECRAFT_KEY_KEY),
  ]);
  const geminiApiKey = decryptSecret(geminiEnc) ?? "";
  const recraftApiKey = decryptSecret(recraftEnc) ?? "";
  return {
    provider: normalizeProvider(provider),
    geminiApiKey,
    recraftApiKey,
    hasGeminiKey: geminiApiKey.length > 0,
    hasRecraftKey: recraftApiKey.length > 0,
  };
}

/** Lee la config pública (SIN keys) — para devolver al cliente. */
export async function getAiPublicConfig(): Promise<AiImagePublicConfig> {
  const full = await getAiConfig();
  return {
    provider: full.provider,
    hasGeminiKey: full.hasGeminiKey,
    hasRecraftKey: full.hasRecraftKey,
  };
}

export interface SetAiConfigInput {
  provider: AiImageProvider;
  /** Si viene vacío/undefined, se conserva la key existente. */
  geminiApiKey?: string;
  /** Si viene vacío/undefined, se conserva la key existente. */
  recraftApiKey?: string;
}

/** Persiste la config de IA. Las keys se guardan encriptadas. */
export async function setAiConfig(input: SetAiConfigInput): Promise<AiImagePublicConfig> {
  await updateSetting(AI_PROVIDER_KEY, normalizeProvider(input.provider));
  const gemini = input.geminiApiKey?.trim();
  if (gemini) {
    await updateSetting(AI_GEMINI_KEY_KEY, encryptSecret(gemini));
  }
  const recraft = input.recraftApiKey?.trim();
  if (recraft) {
    await updateSetting(AI_RECRAFT_KEY_KEY, encryptSecret(recraft));
  }
  return getAiPublicConfig();
}
