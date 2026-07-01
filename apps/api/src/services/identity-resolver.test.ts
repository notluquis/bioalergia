import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    person: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockDb };
});

const { findOrCreatePerson, createPersonWithoutRut } = vi.hoisted(() => ({
  findOrCreatePerson: vi.fn(),
  createPersonWithoutRut: vi.fn(),
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("./people-factory.ts", () => ({ findOrCreatePerson, createPersonWithoutRut }));

import { resolvePerson } from "./identity-resolver.ts";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.person.findUnique.mockResolvedValue(null);
  mockDb.person.update.mockResolvedValue({});
  mockDb.person.updateMany.mockResolvedValue({ count: 1 });
  mockDb.patient.findUnique.mockResolvedValue(null);
  mockDb.patient.create.mockResolvedValue({ id: 500 });
  mockDb.patient.update.mockResolvedValue({});
});

describe("resolvePerson", () => {
  it("tier 1: RUT válido → findOrCreatePerson + crea Patient", async () => {
    findOrCreatePerson.mockResolvedValue({ personId: 10, created: true, rut: "12345678-5" });
    const r = await resolvePerson(
      { rut: "12.345.678-5", names: "Juan Perez Soto" },
      { createPatient: true }
    );
    expect(findOrCreatePerson).toHaveBeenCalledOnce();
    expect(mockDb.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personId: 10 }) })
    );
    expect(r).toMatchObject({ personId: 10, patientId: 500, created: true, action: "created" });
  });

  it("tier 1: RUT inválido cae a tier 2 (external id)", async () => {
    createPersonWithoutRut.mockResolvedValue(77);
    const r = await resolvePerson(
      { rut: "12345678-0", names: "Nicolas Astudillo", doctoraliaExternalId: 999 },
      { createPatient: true }
    );
    expect(findOrCreatePerson).not.toHaveBeenCalled();
    expect(createPersonWithoutRut).toHaveBeenCalledOnce();
    expect(mockDb.person.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { doctoraliaExternalId: 999 } })
    );
    expect(r).toMatchObject({ personId: 77, created: true, action: "created" });
  });

  it("tier 2: external id existente → enrich, no crea (linked)", async () => {
    mockDb.person.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.doctoraliaExternalId === 42) return Promise.resolve({ id: 88 });
      return Promise.resolve({ email: null, phone: null, fatherName: null, motherName: null, sex: null });
    });
    const r = await resolvePerson(
      { names: "Borja Contreras", doctoraliaExternalId: 42, phone: "+56900000000" },
      { createPatient: false }
    );
    expect(createPersonWithoutRut).not.toHaveBeenCalled();
    expect(r).toMatchObject({ personId: 88, created: false, action: "linked" });
  });

  it("tier 3: sin rut ni external id → review (no crea)", async () => {
    const r = await resolvePerson({ names: "Felipe Caripan Cid" });
    expect(findOrCreatePerson).not.toHaveBeenCalled();
    expect(createPersonWithoutRut).not.toHaveBeenCalled();
    expect(r).toMatchObject({ personId: null, patientId: null, action: "review" });
  });

  it("email compartido (familia) NO se pasa al crear (evita colisión @unique)", async () => {
    // email ya tomado por otra Person
    mockDb.person.findUnique.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.email === "familia@mail.com") return Promise.resolve({ id: 1 });
      return Promise.resolve(null); // external id no existe
    });
    createPersonWithoutRut.mockResolvedValue(90);
    await resolvePerson({ names: "Hijo Dos", doctoraliaExternalId: 7, email: "familia@mail.com" });
    expect(createPersonWithoutRut).toHaveBeenCalledWith(
      expect.objectContaining({ email: null })
    );
  });

  it("nombre vacío → review", async () => {
    const r = await resolvePerson({ names: "  ", rut: "12345678-5" });
    expect(r.action).toBe("review");
    expect(findOrCreatePerson).not.toHaveBeenCalled();
  });
});
