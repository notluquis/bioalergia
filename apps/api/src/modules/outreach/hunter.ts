import { db } from "@finanzas/db";

const HUNTER_BASE = "https://api.hunter.io/v2";

function getApiKey(): string {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error("HUNTER_API_KEY no configurada");
  return key;
}

export type HunterVerifyResult = {
  email: string;
  result: "deliverable" | "undeliverable" | "risky" | "unknown" | "accept_all";
  score: number;
  status: string;
  smtp_check: boolean;
  disposable: boolean;
  webmail: boolean;
};

export async function verifyEmail(email: string): Promise<HunterVerifyResult> {
  const apiKey = getApiKey();
  const url = new URL(`${HUNTER_BASE}/email-verifier`);
  url.searchParams.set("email", email);
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Hunter ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: HunterVerifyResult };
  if (!json.data) throw new Error("Hunter respuesta sin data");
  return json.data;
}

export type HunterDomainSearchResult = {
  domain: string;
  pattern: string | null;
  organization: string | null;
  emails: Array<{
    value: string;
    type: string;
    confidence: number;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    department: string | null;
    linkedin: string | null;
    phone_number: string | null;
  }>;
};

export async function domainSearch(domain: string, limit = 10): Promise<HunterDomainSearchResult> {
  const apiKey = getApiKey();
  const url = new URL(`${HUNTER_BASE}/domain-search`);
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("api_key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Hunter ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: HunterDomainSearchResult };
  if (!json.data) throw new Error("Hunter respuesta sin data");
  return json.data;
}

export async function hunterEnrichProspect(rbd: string): Promise<HunterDomainSearchResult> {
  const prospect = await db.outreachEstablishment.findUnique({ where: { rbd } });
  if (!prospect) throw new Error("Prospect no encontrado");
  if (!prospect.dominio) throw new Error("Prospect sin dominio");
  const data = await domainSearch(prospect.dominio);
  for (const e of data.emails) {
    const exists = await db.outreachContact.findFirst({
      where: { establecimientoRbd: rbd, email: e.value },
    });
    if (exists) continue;
    const fullName = [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
    if (!fullName) continue;
    await db.outreachContact.create({
      data: {
        establecimientoRbd: rbd,
        nombre: fullName,
        cargo: e.position ?? "Hunter",
        email: e.value,
        telefono: e.phone_number ?? null,
        notas: e.linkedin ? `LinkedIn: ${e.linkedin}` : null,
      },
    });
  }
  await db.outreachEstablishment.update({
    where: { rbd },
    data: {
      hunterLastFetchedAt: new Date(),
      hunterEmailPattern: data.pattern,
    },
  });
  return data;
}
