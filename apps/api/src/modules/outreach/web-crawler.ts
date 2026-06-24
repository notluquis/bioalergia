import { db } from "@finanzas/db";
import * as cheerio from "cheerio";
import { logWarn } from "../../lib/logger.ts";

const PATHS_CONTACTO = [
  "/contacto",
  "/contactenos",
  "/contactenos.html",
  "/contact",
  "/contact-us",
  "/nosotros",
  "/quienes-somos",
  "/about",
  "/about-us",
  "/equipo",
  "/team",
  "/rrhh",
  "/trabaja-con-nosotros",
  "/",
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_CL_REGEX = /(?:\+?56\s?)?(?:9\s?\d{4}\s?\d{4}|[2-9]\d{8}|[2-9]\s?\d{4}\s?\d{4})/g;

const EMAIL_DENY = [
  /noreply/i,
  /no-reply/i,
  /donotreply/i,
  /example\.com/i,
  /test\./i,
  /\.png$/i,
  /\.jpg$/i,
  /\.jpeg$/i,
  /\.svg$/i,
  /\.webp$/i,
  /sentry\.io/i,
  /wixpress/i,
];

const EMAIL_PRIORITY = [
  /rrhh/i,
  /hr\./i,
  /personas/i,
  /bienestar/i,
  /contacto/i,
  /info/i,
  /gerencia/i,
  /administracion/i,
];

const SOCIAL_PATTERNS = {
  linkedin: /linkedin\.com\/(company|in)\/[a-zA-Z0-9._-]+/g,
  instagram: /instagram\.com\/[a-zA-Z0-9._]+/g,
  facebook: /facebook\.com\/[a-zA-Z0-9._-]+/g,
  twitter: /(?:twitter|x)\.com\/[a-zA-Z0-9_]+/g,
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; BioalergiaCRMBot/1.0; +https://bioalergia.cl/contacto)";

export type CrawlResult = {
  url: string;
  emails: string[];
  phones: string[];
  social: { linkedin?: string; instagram?: string; facebook?: string; twitter?: string };
  rrhhSnippets: string[];
  success: boolean;
  pagesVisited: number;
  error: string | null;
};

function cleanEmails(emails: string[]): string[] {
  const lowered = emails.map((e) => e.trim().toLowerCase());
  const filtered = lowered.filter((e) => !EMAIL_DENY.some((rx) => rx.test(e)));
  const unique = Array.from(new Set(filtered));
  return unique.sort((a, b) => {
    const aPri = EMAIL_PRIORITY.some((rx) => rx.test(a)) ? 0 : 1;
    const bPri = EMAIL_PRIORITY.some((rx) => rx.test(b)) ? 0 : 1;
    return aPri - bPri;
  });
}

function cleanPhones(phones: string[]): string[] {
  const cleaned = phones
    .map((p) => p.replace(/[\s-]/g, "").replace(/^\+?56/, "+56"))
    .filter((p) => /^\+?56\d{8,9}$/.test(p) || /^\d{8,9}$/.test(p));
  return Array.from(new Set(cleaned));
}

function findSocial(html: string): CrawlResult["social"] {
  const out: CrawlResult["social"] = {};
  for (const [k, rx] of Object.entries(SOCIAL_PATTERNS)) {
    const m = html.match(rx);
    if (m && m.length > 0) out[k as keyof CrawlResult["social"]] = `https://${m[0].toLowerCase()}`;
  }
  return out;
}

function findRrhhSnippets(text: string): string[] {
  const out: string[] = [];
  const sentences = text.split(/[.!?\n]/);
  for (const s of sentences) {
    if (/(rrhh|recursos humanos|bienestar|jefe de personas|encargad[oa] de personas)/i.test(s)) {
      const trimmed = s.trim().slice(0, 240);
      if (trimmed.length > 20) out.push(trimmed);
    }
  }
  return Array.from(new Set(out)).slice(0, 5);
}

export async function crawlSite(websiteUrl: string, timeoutMs = 10000): Promise<CrawlResult> {
  const result: CrawlResult = {
    url: websiteUrl,
    emails: [],
    phones: [],
    social: {},
    rrhhSnippets: [],
    success: false,
    pagesVisited: 0,
    error: null,
  };
  let origin: string;
  try {
    origin = new URL(websiteUrl).origin;
  } catch (err) {
    result.error = `URL inválida: ${err instanceof Error ? err.message : "?"}`;
    return result;
  }

  const seenEmails = new Set<string>();
  const seenPhones = new Set<string>();
  let socialMerged: CrawlResult["social"] = {};
  let rrhh: string[] = [];

  for (const path of PATHS_CONTACTO) {
    const url = `${origin}${path}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
        redirect: "follow",
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) continue;
      const html = await res.text();
      result.pagesVisited += 1;

      const $ = cheerio.load(html);
      const text = $("body").text();
      const fromText = text.match(EMAIL_REGEX) ?? [];
      const fromMailto: string[] = [];
      $('a[href^="mailto:"]').each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const e = href.replace(/^mailto:/, "").split("?")[0];
        if (e) fromMailto.push(e);
      });
      for (const e of [...fromText, ...fromMailto]) seenEmails.add(e);

      const phones = text.match(PHONE_CL_REGEX) ?? [];
      for (const p of phones) seenPhones.add(p);

      socialMerged = { ...socialMerged, ...findSocial(html) };
      rrhh = [...rrhh, ...findRrhhSnippets(text)];

      if (cleanEmails(Array.from(seenEmails)).length > 0 && path !== "/") break;
    } catch (err) {
      logWarn("[outreach.web-crawler] page failed", {
        url,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
  }

  result.emails = cleanEmails(Array.from(seenEmails));
  result.phones = cleanPhones(Array.from(seenPhones));
  result.social = socialMerged;
  result.rrhhSnippets = Array.from(new Set(rrhh)).slice(0, 5);
  result.success = result.emails.length > 0 || result.phones.length > 0;
  return result;
}

export async function crawlProspect(rbd: string): Promise<CrawlResult> {
  const prospect = await db.outreachEstablishment.findUnique({ where: { rbd } });
  if (!prospect) throw new Error("Prospect no encontrado");
  if (!prospect.websiteUrl) {
    return {
      url: "",
      emails: [],
      phones: [],
      social: {},
      rrhhSnippets: [],
      success: false,
      pagesVisited: 0,
      error: "Sin websiteUrl",
    };
  }
  const result = await crawlSite(prospect.websiteUrl);
  await db.outreachEstablishment.update({
    where: { rbd },
    data: {
      crawledAt: new Date(),
      crawlSuccess: result.success,
      emailsAdicionales: Array.from(new Set([...prospect.emailsAdicionales, ...result.emails])),
      telefonosAdicionales: Array.from(
        new Set([...prospect.telefonosAdicionales, ...result.phones])
      ),
      linkedinUrl: prospect.linkedinUrl ?? result.social.linkedin ?? null,
      notas: result.rrhhSnippets.length
        ? `${prospect.notas ? prospect.notas + "\n\n" : ""}[Crawler RRHH] ${result.rrhhSnippets.join(" | ")}`
        : prospect.notas,
    },
  });
  return result;
}
