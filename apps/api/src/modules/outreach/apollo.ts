import { db } from "@finanzas/db";
import { logWarn } from "../../lib/logger";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

type ApolloOrganization = {
  id?: string;
  name?: string;
  website_url?: string;
  primary_domain?: string;
  industry?: string;
  estimated_num_employees?: number;
  linkedin_url?: string;
  phone?: string;
  raw_address?: string;
};

type ApolloPerson = {
  id?: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  linkedin_url?: string;
  phone_numbers?: Array<{ raw_number?: string }>;
};

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error("APOLLO_API_KEY no configurada");
  return key;
}

async function apolloRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = getApiKey();
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST",
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apollo ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function organizationEnrich(domain: string): Promise<ApolloOrganization | null> {
  try {
    const data = await apolloRequest<{ organization?: ApolloOrganization }>(
      "/organizations/enrich",
      { domain },
    );
    return data.organization ?? null;
  } catch (err) {
    logWarn("[outreach.apollo] organizationEnrich failed", {
      domain,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

const RRHH_TITLES = [
  "recursos humanos",
  "rrhh",
  "human resources",
  "people",
  "personas",
  "bienestar",
  "talento",
  "gerente general",
  "director general",
];

export async function peopleSearchByDomain(
  domain: string,
  perPage = 5,
): Promise<ApolloPerson[]> {
  try {
    const data = await apolloRequest<{ people?: ApolloPerson[] }>(
      "/mixed_people/search",
      {
        q_organization_domains: domain,
        person_titles: RRHH_TITLES,
        page: 1,
        per_page: perPage,
      },
    );
    return data.people ?? [];
  } catch (err) {
    logWarn("[outreach.apollo] peopleSearch failed", {
      domain,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export type ApolloEnrichResult = {
  organization: ApolloOrganization | null;
  people: ApolloPerson[];
  contactsCreated: number;
};

export async function enrichProspectWithApollo(rbd: string): Promise<ApolloEnrichResult> {
  const prospect = await db.outreachEstablishment.findUnique({ where: { rbd } });
  if (!prospect) throw new Error("Prospect no encontrado");
  if (!prospect.dominio) {
    throw new Error("Prospect sin dominio (corre crawler primero o agrega website manual)");
  }
  const [organization, people] = await Promise.all([
    organizationEnrich(prospect.dominio).catch(() => null),
    peopleSearchByDomain(prospect.dominio).catch(() => []),
  ]);

  let contactsCreated = 0;
  for (const p of people) {
    if (!p.name) continue;
    const email = p.email && !p.email.startsWith("email_not_unlocked") ? p.email : null;
    const exists = await db.outreachContact.findFirst({
      where: { establecimientoRbd: rbd, nombre: p.name },
    });
    if (exists) continue;
    await db.outreachContact.create({
      data: {
        establecimientoRbd: rbd,
        nombre: p.name,
        cargo: p.title ?? "Apollo",
        email,
        telefono: p.phone_numbers?.[0]?.raw_number ?? null,
        notas: p.linkedin_url ? `LinkedIn: ${p.linkedin_url}` : null,
      },
    });
    contactsCreated += 1;
  }

  await db.outreachEstablishment.update({
    where: { rbd },
    data: {
      apolloOrgId: organization?.id ?? null,
      apolloLastFetchedAt: new Date(),
      linkedinUrl: prospect.linkedinUrl ?? organization?.linkedin_url ?? null,
    },
  });

  return { organization, people, contactsCreated };
}
