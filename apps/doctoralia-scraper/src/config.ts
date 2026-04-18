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
  cookieJarPath: z.string(),
  capturesDir: z.string(),
});

export type ScraperConfig = z.infer<typeof configSchema>;

export function loadConfig(): ScraperConfig {
  return configSchema.parse({
    baseUrl: process.env.DOCTORALIA_SCRAPER_BASE_URL ?? "https://docplanner.doctoralia.cl",
    email: process.env.DOCTORALIA_SCRAPER_EMAIL ?? "",
    password: process.env.DOCTORALIA_SCRAPER_PASSWORD ?? "",
    importEndpoint: process.env.DOCTORALIA_SCRAPER_IMPORT_ENDPOINT || undefined,
    importToken: process.env.DOCTORALIA_SCRAPER_IMPORT_TOKEN || undefined,
    cookieJarPath: path.join(__dirname, "..", ".cookies.json"),
    capturesDir: path.join(__dirname, "..", "captures"),
  });
}
