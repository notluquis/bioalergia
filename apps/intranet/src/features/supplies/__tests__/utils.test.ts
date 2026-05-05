import { describe, expect, it } from "vitest";
import { translateStatus } from "../utils";

describe("translateStatus", () => {
  it("translates all known statuses", () => {
    expect(translateStatus("pending")).toBe("Pendiente");
    expect(translateStatus("ordered")).toBe("Pedido");
    expect(translateStatus("in_transit")).toBe("En Tránsito");
    expect(translateStatus("delivered")).toBe("Entregado");
    expect(translateStatus("rejected")).toBe("Rechazado");
  });

  it("returns unknown status as-is", () => {
    expect(translateStatus("unknown_status" as never)).toBe("unknown_status");
  });
});
