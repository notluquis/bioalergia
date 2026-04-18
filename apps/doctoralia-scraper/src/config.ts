import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });

const configSchema = z.object({
  baseUrl: z.string().url(),
  email: z.string().min(1, "DOCTORALIA_SCRAPER_EMAIL is required"),
  password: z.string().min(1, "DOCTORALIA_SCRAPER_PASSWORD is required"),
  importEndpoint: z.string().url().optional(),
  importToken: z.string().optional(),
  cookiesEndpoint: z.string().url(),
  cookiesApiToken: z.string().min(1, "DOCTORALIA_SCRAPER_API_TOKEN is required"),
  cookiesLabel: z.string().min(1),
  cookieJarPath: z.string(),
  capturesDir: z.string(),
  oneUserId: z.string().min(1, "DOCTORALIA_SCRAPER_ONE_USER_ID is required"),
  userType: z.string().min(1),
  countryId: z.string().min(1),
  frontVersionFallback: z.string().optional(),
  windowDays: z.number().int().positive(),
  windowsPerRun: z.number().int().positive(),
});

export type ScraperConfig = z.infer<typeof configSchema>;

export function loadConfig(): ScraperConfig {
  return configSchema.parse({
    baseUrl: process.env.DOCTORALIA_SCRAPER_BASE_URL ?? "https://docplanner.doctoralia.cl",
    email: process.env.DOCTORALIA_SCRAPER_EMAIL ?? "",
    password: process.env.DOCTORALIA_SCRAPER_PASSWORD ?? "",
    importEndpoint: process.env.DOCTORALIA_SCRAPER_IMPORT_ENDPOINT || undefined,
    importToken: process.env.DOCTORALIA_SCRAPER_IMPORT_TOKEN || undefined,
    cookiesEndpoint:
      process.env.DOCTORALIA_SCRAPER_COOKIES_ENDPOINT ??
      "http://localhost:4000/api/scraper/doctoralia/cookies",
    cookiesApiToken: process.env.DOCTORALIA_SCRAPER_API_TOKEN ?? "",
    cookiesLabel: process.env.DOCTORALIA_SCRAPER_COOKIES_LABEL ?? "default",
    cookieJarPath: path.join(__dirname, "..", ".cookies.json"),
    capturesDir: path.join(__dirname, "..", "captures"),
    oneUserId: process.env.DOCTORALIA_SCRAPER_ONE_USER_ID ?? "",
    userType: process.env.DOCTORALIA_SCRAPER_USER_TYPE ?? "secretary",
    countryId: process.env.DOCTORALIA_SCRAPER_COUNTRY_ID ?? "CL",
    frontVersionFallback: process.env.DOCTORALIA_SCRAPER_FRONT_VERSION || undefined,
    windowDays: Number(process.env.DOCTORALIA_SCRAPER_WINDOW_DAYS ?? 7),
    windowsPerRun: Number(process.env.DOCTORALIA_SCRAPER_WINDOWS_PER_RUN ?? 8),
  });
}
