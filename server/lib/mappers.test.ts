import { PersonType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { mapPerson } from "./mappers.js";

describe("mapPerson", () => {
  it("should properly concatenate full_name from names + fatherName + motherName", () => {
    const person = {
      id: 1,
      rut: "12345678-9",
      names: "Juan",
      fatherName: "García",
      motherName: "López",
      email: "juan@example.com",
      phone: null,
      address: null,
      personType: "NATURAL" as PersonType,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: null,
      employee: null,
      counterpart: null,
    };

    const mapped = mapPerson(person);

    expect(mapped.full_name).toBe("Juan García López");
    expect(mapped.names).toBe("Juan");
    expect(mapped.father_name).toBe("García");
    expect(mapped.mother_name).toBe("López");
  });

  it("should handle partial names gracefully", () => {
    const person = {
      id: 1,
      rut: "12345678-9",
      names: "Juan",
      fatherName: "García",
      motherName: null,
      email: "juan@example.com",
      phone: null,
      address: null,
      personType: "NATURAL" as PersonType,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: null,
      employee: null,
      counterpart: null,
    };

    const mapped = mapPerson(person);

    expect(mapped.full_name).toBe("Juan García");
  });

  it("should return only names if father and mother names are null", () => {
    const person = {
      id: 1,
      rut: "12345678-9",
      names: "Juan",
      fatherName: null,
      motherName: null,
      email: "juan@example.com",
      phone: null,
      address: null,
      personType: "NATURAL" as PersonType,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: null,
      employee: null,
      counterpart: null,
    };

    const mapped = mapPerson(person);

    expect(mapped.full_name).toBe("Juan");
  });
});
