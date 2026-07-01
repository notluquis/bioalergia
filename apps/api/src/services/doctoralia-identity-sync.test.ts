import { describe, expect, it } from "vitest";
import { extractRutFromComments, splitChileanName } from "./doctoralia-identity-sync.ts";

describe("splitChileanName", () => {
  it("2 tokens → nombre + 1 apellido", () => {
    expect(splitChileanName("Borja Contreras")).toEqual({
      names: "Borja",
      fatherName: "Contreras",
      motherName: null,
    });
  });
  it("3 tokens → nombre + 2 apellidos", () => {
    expect(splitChileanName("Felipe Caripan Cid")).toEqual({
      names: "Felipe",
      fatherName: "Caripan",
      motherName: "Cid",
    });
  });
  it("4 tokens → 2 nombres + 2 apellidos", () => {
    expect(splitChileanName("Lucca Alexander Cifuentes Marín")).toEqual({
      names: "Lucca Alexander",
      fatherName: "Cifuentes",
      motherName: "Marín",
    });
  });
  it("espacios extra colapsan", () => {
    expect(splitChileanName("  Juan   Perez  ")).toEqual({
      names: "Juan",
      fatherName: "Perez",
      motherName: null,
    });
  });
});

describe("extractRutFromComments", () => {
  it("extrae RUT con guión válido", () => {
    expect(extractRutFromComments("27055685-k\n6 años")).toBe("27055685-k");
  });
  it("extrae RUT con puntos", () => {
    expect(extractRutFromComments("consulto 25.222.151-4 por examen")).toBe("25.222.151-4");
  });
  it("ignora teléfono de 9 dígitos sin guión", () => {
    expect(extractRutFromComments("llamar al 273330909")).toBeNull();
  });
  it("ignora RUT con guión pero DV inválido", () => {
    expect(extractRutFromComments("12345678-0 mal dv")).toBeNull();
  });
  it("null si no hay comments", () => {
    expect(extractRutFromComments(null)).toBeNull();
  });
});
