// Config de redes sociales en DB (no env). El flag dry-run vive en Setting
// `social.publishDryRun` y se administra desde la intranet. Fallback al env
// legacy SOCIAL_PUBLISH_DRYRUN y, por seguridad, default = true (no publica).

import { getSetting, updateSetting } from "./settings.ts";

const DRYRUN_KEY = "social.publishDryRun";

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
