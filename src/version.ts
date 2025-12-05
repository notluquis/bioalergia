import appPackage from "../package.json" assert { type: "json" };

export const APP_VERSION: string = (appPackage as { version?: string }).version ?? "0.0.0";
export const BUILD_TIMESTAMP: string = import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? new Date().toISOString();
