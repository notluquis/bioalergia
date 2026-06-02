import { describe, expect, it, vi } from "vitest";

// findOrCreatePerson / createPersonWithoutRut read+write db.person
// (findUnique / create / update). Mock @finanzas/db (+ slices per the repo
// rule — slices.ts calls db.$setOptions at module-load). RUT canonicalisation
// + mod-11 validation are REAL (lib/rut.ts, pure) so dedup-key formation and
// validation rejection are exercised end-to-end.

type PersonRow = {
  id: number;
  rut: string | null;
  names: string;
  fatherName: string | null;
  motherName: string | null;
  email: string | null;
  phone: string | null;
  personType: string;
};

const { mockDb, mockFindUnique, mockCreate, mockUpdate } = vi.hoisted(() => {
  const mockFindUnique = vi.fn();
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();
  const mockDb = {
    person: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
    },
  };
  return { mockDb, mockFindUnique, mockCreate, mockUpdate };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { findOrCreatePerson, createPersonWithoutRut } = await import("../people-factory.ts");

// A valid mod-11 RUT (24597904-5). 24597904-K is the WRONG DV (the historical
// Ruminot duplicate). 12345678-5 and 11111111-1 are also valid.
const VALID_RUT = "24597904-5";

function existing(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: 42,
    rut: VALID_RUT,
    names: "Juan",
    fatherName: "Perez",
    motherName: "Gomez",
    email: "juan@example.com",
    phone: "+56911111111",
    personType: "NATURAL",
    ...overrides,
  };
}

function resetDb() {
  mockFindUnique.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
}

describe("findOrCreatePerson — input validation", () => {
  it("rechaza names vacío (string vacío)", async () => {
    resetDb();
    await expect(findOrCreatePerson({ rut: VALID_RUT, names: "" })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: expect.stringMatching(/names/i),
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rechaza names que es solo whitespace (trimOrNull → null)", async () => {
    resetDb();
    await expect(findOrCreatePerson({ rut: VALID_RUT, names: "   " })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rechaza RUT con DV equivocado (mod-11): 24597904-K", async () => {
    resetDb();
    await expect(
      findOrCreatePerson({ rut: "24597904-K", names: "Juan" })
    ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rechaza RUT con formato inválido (sin dígitos)", async () => {
    resetDb();
    await expect(
      findOrCreatePerson({ rut: "no-es-rut!!!", names: "Juan" })
    ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("incluye el rut original en details del DomainError al fallar validación", async () => {
    resetDb();
    await expect(
      findOrCreatePerson({ rut: "24597904-K", names: "Juan" })
    ).rejects.toMatchObject({ details: { rut: "24597904-K" } });
  });

  it("rechaza cuando no hay RUT (null) — fuerza al caller a entregar RUT", async () => {
    resetDb();
    await expect(findOrCreatePerson({ rut: null, names: "Juan" })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: expect.stringMatching(/RUT es obligatorio/i),
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("incluye names en details del error 'RUT es obligatorio'", async () => {
    resetDb();
    await expect(findOrCreatePerson({ rut: null, names: "Pedro Soto" })).rejects.toMatchObject({
      details: { names: "Pedro Soto" },
    });
  });

  it("rechaza cuando rut es undefined", async () => {
    resetDb();
    await expect(
      findOrCreatePerson({ rut: undefined, names: "Juan" })
    ).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("rechaza cuando rut es solo whitespace (trimOrNull → null → sin RUT)", async () => {
    resetDb();
    await expect(findOrCreatePerson({ rut: "   ", names: "Juan" })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: expect.stringMatching(/RUT es obligatorio/i),
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe("findOrCreatePerson — RUT canonicalisation (dedup key)", () => {
  it("canonicaliza el RUT antes de buscar (24.597.904-5 → 24597904-5)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 7 });

    await findOrCreatePerson({ rut: "24.597.904-5", names: "Juan" });

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { rut: "24597904-5" } });
  });

  it("devuelve el RUT canónico en el resultado, no el input crudo", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 7 });

    const res = await findOrCreatePerson({ rut: "24.597.904-5", names: "Juan" });

    expect(res.rut).toBe("24597904-5");
  });

  it("normaliza DV minúscula 'k' a mayúscula 'K'", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 7 });

    // 6-K es válido mod-11; pasamos "6-k" → canónico "6-K"
    await findOrCreatePerson({ rut: "6-k", names: "Juan" });

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { rut: "6-K" } });
  });
});

describe("findOrCreatePerson — create path", () => {
  it("crea con personType por defecto NATURAL cuando no se entrega", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 99 });

    const res = await findOrCreatePerson({ rut: VALID_RUT, names: "Juan Pablo" });

    expect(res).toEqual({ personId: 99, created: true, rut: VALID_RUT });
    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.personType).toBe("NATURAL");
    expect(arg.data.rut).toBe(VALID_RUT);
    expect(arg.data.names).toBe("Juan Pablo");
  });

  it("persiste los campos opcionales NO vacíos al crear (?? null, no && null)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 100 });

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan",
      fatherName: "Perez",
      motherName: "Gomez",
      email: "j@x.com",
      phone: "+56900000000",
    });

    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.fatherName).toBe("Perez");
    expect(arg.data.motherName).toBe("Gomez");
    expect(arg.data.email).toBe("j@x.com");
    expect(arg.data.phone).toBe("+56900000000");
  });

  it("respeta personType explícito (LEGAL)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 99 });

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Empresa SpA",
      personType: "LEGAL" as never,
    });

    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.personType).toBe("LEGAL");
  });

  it("trim-ea y normaliza a null los campos opcionales vacíos al crear", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 99 });

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "  Juan  ",
      fatherName: "   ",
      motherName: null,
      email: "",
      phone: "  +56922222222  ",
    });

    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.names).toBe("Juan");
    expect(arg.data.fatherName).toBeNull();
    expect(arg.data.motherName).toBeNull();
    expect(arg.data.email).toBeNull();
    expect(arg.data.phone).toBe("+56922222222");
  });

  it("created=true marca explícitamente el alta", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 5 });
    const res = await findOrCreatePerson({ rut: VALID_RUT, names: "Juan" });
    expect(res.created).toBe(true);
  });
});

describe("findOrCreatePerson — strategy: preserve", () => {
  it("no toca la fila existente y devuelve created=false", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(existing());

    const res = await findOrCreatePerson({
      rut: VALID_RUT,
      names: "OtroNombre",
      mergeStrategy: "preserve",
    });

    expect(res).toEqual({ personId: 42, created: false, rut: VALID_RUT });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("findOrCreatePerson — strategy: overwrite", () => {
  it("reemplaza names verbatim con el input", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(existing({ names: "Juan" }));
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Nombre Nuevo",
      mergeStrategy: "overwrite",
    });

    const arg = mockUpdate.mock.calls[0]?.[0] as { where: { id: number }; data: PersonRow };
    expect(arg.where.id).toBe(42);
    expect(arg.data.names).toBe("Nombre Nuevo");
  });

  it("usa el valor existente cuando el input opcional es vacío (inputFather ?? existing)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ fatherName: "PerezExistente", email: "old@x.com" })
    );
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan",
      fatherName: "   ", // vacío → fallback a existing
      email: "new@x.com", // presente → reemplaza
      mergeStrategy: "overwrite",
    });

    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.fatherName).toBe("PerezExistente");
    expect(arg.data.email).toBe("new@x.com");
  });

  it("NO actualiza cuando overwrite no cambia nada (changed=false)", async () => {
    resetDb();
    const row = existing();
    mockFindUnique.mockResolvedValue(row);

    const res = await findOrCreatePerson({
      rut: VALID_RUT,
      names: row.names,
      fatherName: row.fatherName,
      motherName: row.motherName,
      email: row.email,
      phone: row.phone,
      mergeStrategy: "overwrite",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res).toEqual({ personId: 42, created: false, rut: VALID_RUT });
  });

  it("actualiza cuando SOLO el email difiere (detecta cambio campo por campo)", async () => {
    resetDb();
    const row = existing();
    mockFindUnique.mockResolvedValue(row);
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: row.names,
      fatherName: row.fatherName,
      motherName: row.motherName,
      email: "changed@x.com",
      phone: row.phone,
      mergeStrategy: "overwrite",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.email).toBe("changed@x.com");
  });

  it("actualiza cuando SOLO motherName difiere (rama || del changed)", async () => {
    resetDb();
    const row = existing();
    mockFindUnique.mockResolvedValue(row);
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: row.names,
      fatherName: row.fatherName,
      motherName: "GomezCambiado",
      email: row.email,
      phone: row.phone,
      mergeStrategy: "overwrite",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.motherName).toBe("GomezCambiado");
  });

  it("actualiza cuando SOLO phone difiere (rama || final del changed)", async () => {
    resetDb();
    const row = existing();
    mockFindUnique.mockResolvedValue(row);
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: row.names,
      fatherName: row.fatherName,
      motherName: row.motherName,
      email: row.email,
      phone: "+56999999999",
      mergeStrategy: "overwrite",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.phone).toBe("+56999999999");
  });

  it("overwrite escribe motherName/phone del input cuando difieren (inputX ?? existing)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ motherName: "Vieja", phone: "+56900000000" })
    );
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan",
      motherName: "GomezNueva",
      phone: "+56988888888",
      mergeStrategy: "overwrite",
    });

    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.motherName).toBe("GomezNueva");
    expect(arg.data.phone).toBe("+56988888888");
  });

  it("overwrite cae a existing en motherName/phone cuando el input es vacío", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ motherName: "GomezExistente", phone: "+56900000000", names: "X" })
    );
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Cambia", // fuerza update
      motherName: "   ",
      phone: "",
      mergeStrategy: "overwrite",
    });

    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.motherName).toBe("GomezExistente");
    expect(arg.data.phone).toBe("+56900000000");
  });
});

describe("findOrCreatePerson — strategy: enrich (default)", () => {
  it("es la estrategia por defecto cuando mergeStrategy es undefined", async () => {
    resetDb();
    // existing tiene email; enrich NO lo pisa aunque venga input → no cambia
    mockFindUnique.mockResolvedValue(existing());

    const res = await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan", // igual de largo que el existente → preferLonger mantiene existing
      email: "no-deberia-pisar@x.com",
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res.created).toBe(false);
  });

  it("default (?? enrich): nombre más largo gatilla update vía preferLonger", async () => {
    resetDb();
    // mergeStrategy undefined → debe comportarse como enrich y actualizar names.
    mockFindUnique.mockResolvedValue(existing({ names: "Jo" }));
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({ rut: VALID_RUT, names: "Jonathan" });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.names).toBe("Jonathan");
  });

  it("preferLonger usa incoming cuando existing es null (fatherName null → input)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ fatherName: null, motherName: null, email: "k@x.com", phone: "p" })
    );
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan",
      fatherName: "Perez",
      motherName: "Gomez",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.fatherName).toBe("Perez");
    expect(arg.data.motherName).toBe("Gomez");
  });

  it("preferLonger con largos IGUALES mantiene el existente (> estricto, no >=)", async () => {
    resetDb();
    // names "Ana" (3) existente, input "Eva" (3) → mismo largo → mantiene "Ana".
    // fatherName fuerza el update para poder inspeccionar names.
    mockFindUnique.mockResolvedValue(
      existing({ names: "Ana", fatherName: null, motherName: null, email: "k@x.com", phone: "p" })
    );
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Eva",
      fatherName: "Soto", // null existente → gatilla update
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.names).toBe("Ana"); // se queda el existente, NO "Eva"
  });

  it("preferLonger: reemplaza names cuando el input es más largo", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(existing({ names: "Jo" }));
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({ rut: VALID_RUT, names: "Jonathan" });

    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.names).toBe("Jonathan");
  });

  it("preferLonger: mantiene el existente cuando el input es más corto", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ names: "Jonathan", fatherName: "Larga", email: null, phone: null })
    );

    await findOrCreatePerson({ rut: VALID_RUT, names: "Jo", fatherName: "X" });

    // names más corto → existing; fatherName "X" más corto que "Larga" → existing.
    // Nada cambia → sin update.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("enrich rellena email SOLO si el existente es null (existing.email ?? input)", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(existing({ email: null, phone: null }));
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan",
      email: "fill@x.com",
      phone: "+56933333333",
    });

    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.email).toBe("fill@x.com");
    expect(arg.data.phone).toBe("+56933333333");
  });

  it("enrich NO pisa el email existente con el input", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ email: "keep@x.com", names: "Jonathan", fatherName: "Larga" })
    );

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Jo", // más corto → no cambia
      email: "ignore@x.com",
    });

    // existing.email se mantiene, nada cambia → sin update
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("enrich preferLonger fatherName/motherName de forma independiente", async () => {
    resetDb();
    mockFindUnique.mockResolvedValue(
      existing({ fatherName: "Pe", motherName: "Gonzalez", email: "k@x.com" })
    );
    mockUpdate.mockResolvedValue({});

    await findOrCreatePerson({
      rut: VALID_RUT,
      names: "Juan",
      fatherName: "Perez", // más largo → reemplaza
      motherName: "Go", // más corto → mantiene
    });

    const arg = mockUpdate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.fatherName).toBe("Perez");
    expect(arg.data.motherName).toBe("Gonzalez");
  });

  it("preferLonger names: cae a existing.names cuando preferLonger devolviera null-ish", async () => {
    resetDb();
    // names existente vacío + input vacío es imposible (input ya validado no-vacío),
    // pero verificamos que el fallback `?? existing.names` no rompe igualdad.
    mockFindUnique.mockResolvedValue(existing({ names: "Juan" }));
    const res = await findOrCreatePerson({ rut: VALID_RUT, names: "Juan" });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(res.personId).toBe(42);
  });
});

describe("createPersonWithoutRut", () => {
  it("crea con rut null y devuelve el id", async () => {
    resetDb();
    mockCreate.mockResolvedValue({ id: 314 });

    const id = await createPersonWithoutRut({
      rut: null,
      names: "Sin Rut",
      fatherName: "Soto",
      motherName: "Diaz",
      phone: "+56977777777",
    });

    expect(id).toBe(314);
    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.rut).toBeNull();
    expect(arg.data.names).toBe("Sin Rut");
    expect(arg.data.personType).toBe("NATURAL");
    // ?? null (NOT && null): valores presentes deben persistir.
    expect(arg.data.fatherName).toBe("Soto");
    expect(arg.data.motherName).toBe("Diaz");
    expect(arg.data.phone).toBe("+56977777777");
  });

  it("rechaza names vacío con mensaje específico", async () => {
    resetDb();
    await expect(createPersonWithoutRut({ rut: null, names: "  " })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: "Person.names es obligatorio",
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("trim-ea names y normaliza opcionales a null", async () => {
    resetDb();
    mockCreate.mockResolvedValue({ id: 1 });

    await createPersonWithoutRut({
      rut: null,
      names: "  Maria  ",
      fatherName: "",
      email: "  m@x.com  ",
    });

    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.names).toBe("Maria");
    expect(arg.data.fatherName).toBeNull();
    expect(arg.data.email).toBe("m@x.com");
  });

  it("respeta personType explícito", async () => {
    resetDb();
    mockCreate.mockResolvedValue({ id: 1 });
    await createPersonWithoutRut({
      rut: null,
      names: "Empresa",
      personType: "LEGAL" as never,
    });
    const arg = mockCreate.mock.calls[0]?.[0] as { data: PersonRow };
    expect(arg.data.personType).toBe("LEGAL");
  });
});
