// Settings DB accessors moved to lib/settings.ts (lower tier per DAG).
// This file remains as a shim so existing imports keep working without
// path churn. New code should import from "../lib/settings.ts" directly.
export {
  loadSettings,
  getSettings,
  getSetting,
  updateSetting,
  deleteSetting,
  updateSettings,
} from "../lib/settings.ts";
