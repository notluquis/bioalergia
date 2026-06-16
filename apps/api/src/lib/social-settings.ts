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
