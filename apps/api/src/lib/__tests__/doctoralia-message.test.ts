import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/settings", () => ({
  getSetting: vi.fn(async () => null),
}));

import { buildDoctoraliaMessage } from "../whatsapp/doctoralia-message.ts";
import { formatChileDateTime } from "../time.ts";

describe("doctoralia whatsapp message", () => {
  it("uses the shared Chile datetime formatter", () => {
    expect(formatChileDateTime(new Date("2026-04-25T18:00:00.000Z"))).toBe("25/04/2026 14:00");
  });

  it("formats appointment time in Chile timezone instead of server runtime timezone", async () => {
    const message = await buildDoctoraliaMessage({
      appointmentDate: new Date("2026-04-25T18:00:00.000Z"),
      appointmentDoctor: "José Manuel Martínez",
      appointmentService: "Consulta",
      clinicAddress: "Bioalergia",
      eventType: "BOOKING",
      patientEmail: null,
      patientName: "Nicolas Aribel",
      patientPhone: "+56912345678",
      previousAppointmentDate: null,
    });

    expect(message).toContain("Fecha y hora: 25/04/2026 14:00");
    expect(message).not.toContain("Fecha y hora: 25/04/2026 18:00");
  });
});
