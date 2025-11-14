import appPackage from "../package.json" assert { type: "json" };

const fallbackTimestamp = (() => {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
})();

export const APP_VERSION: string = (appPackage as { version?: string }).version ?? "0.0.0";
export const BUILD_TIMESTAMP: string =
  (import.meta.env.VITE_APP_BUILD_TIMESTAMP as string | undefined) ?? fallbackTimestamp;
export const BUILD_ID: string = (import.meta.env.VITE_APP_BUILD_ID as string | undefined) ?? BUILD_TIMESTAMP;
