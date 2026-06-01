import { db } from "@finanzas/db";
import type { CreateCompanyInput, UpdateCompanyInput } from "@finanzas/orpc-contracts/quotes";
import { DomainError } from "../lib/errors.ts";

const companyInclude = { contacts: { orderBy: { id: "asc" as const } } };

type CompanyWithContacts = NonNullable<Awaited<ReturnType<typeof getCompanyById>>>;

export function serializeCompany(c: CompanyWithContacts) {
  return {
    id: c.id,
    razonSocial: c.razonSocial,
    rut: c.rut,
    giro: c.giro,
    direccion: c.direccion,
    comuna: c.comuna,
    ciudad: c.ciudad,
    email: c.email,
    phone: c.phone,
    condicionPago: c.condicionPago,
    notes: c.notes,
    isActive: c.isActive,
    contacts: c.contacts.map((ct: CompanyWithContacts["contacts"][number]) => ({
      id: ct.id,
      companyId: ct.companyId,
      personId: ct.personId,
      name: ct.name,
      email: ct.email,
      phone: ct.phone,
      role: ct.role,
    })),
  };
}

export async function getCompanyById(id: number) {
  return db.company.findUnique({ where: { id }, include: companyInclude });
}

export async function getCompanyOrThrow(id: number) {
  const company = await getCompanyById(id);
  if (!company) throw new DomainError("NOT_FOUND", "Empresa no encontrada");
  return company;
}

export async function listCompanies(q?: string) {
  const trimmed = q?.trim();
  const where = trimmed
    ? {
        OR: [
          { razonSocial: { contains: trimmed, mode: "insensitive" as const } },
          { rut: { contains: trimmed, mode: "insensitive" as const } },
          { giro: { contains: trimmed, mode: "insensitive" as const } },
        ],
      }
    : undefined;
  return db.company.findMany({
    where,
    include: companyInclude,
    orderBy: { razonSocial: "asc" },
    take: 500,
  });
}

export async function createCompany(input: CreateCompanyInput) {
  if (input.rut) {
    const existing = await db.company.findUnique({ where: { rut: input.rut.trim() } });
    if (existing) throw new DomainError("CONFLICT", "Ya existe una empresa con ese RUT");
  }
  return db.company.create({
    data: {
      razonSocial: input.razonSocial.trim(),
      rut: input.rut?.trim() || null,
      giro: input.giro ?? null,
      direccion: input.direccion ?? null,
      comuna: input.comuna ?? null,
      ciudad: input.ciudad ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      condicionPago: input.condicionPago ?? null,
      notes: input.notes ?? null,
      isActive: input.isActive,
      contacts: input.contacts?.length
        ? {
            create: input.contacts.map((ct) => ({
              personId: ct.personId ?? null,
              name: ct.name.trim(),
              email: ct.email ?? null,
              phone: ct.phone ?? null,
              role: ct.role ?? null,
            })),
          }
        : undefined,
    },
    include: companyInclude,
  });
}

export async function updateCompany(input: UpdateCompanyInput) {
  const { id, contacts, ...rest } = input;
  await getCompanyOrThrow(id);

  if (rest.rut) {
    const clash = await db.company.findFirst({
      where: { rut: rest.rut.trim(), NOT: { id } },
    });
    if (clash) throw new DomainError("CONFLICT", "Otra empresa ya usa ese RUT");
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = typeof v === "string" ? v.trim() || null : v;
  }
  if (rest.razonSocial !== undefined) data.razonSocial = rest.razonSocial.trim();

  // Reemplazo total de contactos si vienen en el payload.
  if (contacts !== undefined) {
    await db.companyContact.deleteMany({ where: { companyId: id } });
    data.contacts = {
      create: contacts.map((ct) => ({
        personId: ct.personId ?? null,
        name: ct.name.trim(),
        email: ct.email ?? null,
        phone: ct.phone ?? null,
        role: ct.role ?? null,
      })),
    };
  }

  return db.company.update({ where: { id }, data, include: companyInclude });
}

export async function deleteCompany(id: number) {
  const quoteCount = await db.quote.count({ where: { companyId: id } });
  if (quoteCount > 0) {
    throw new DomainError(
      "CONFLICT",
      "No se puede eliminar: la empresa tiene cotizaciones asociadas"
    );
  }
  await db.company.delete({ where: { id } });
}
