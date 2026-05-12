import { describe, expect, it } from "vitest";
import { getAttendanceNetworkOrigin } from "../network-origin";

describe("getAttendanceNetworkOrigin", () => {
  it("returns default when mark is null", () => {
    const result = getAttendanceNetworkOrigin(null);
    expect(result.tone).toBe("default");
    expect(result.label).toBe("Sin marca");
  });

  it("returns success for office network", () => {
    const result = getAttendanceNetworkOrigin({
      connectionType: null,
      createdByUserId: null,
      ipAddress: "192.168.1.1",
      isOfficeNetwork: true,
      latitude: null,
      longitude: null,
    });
    expect(result.tone).toBe("success");
    expect(result.label).toBe("Oficina");
  });

  it("returns admin correction when created by user with no IP/GPS", () => {
    const result = getAttendanceNetworkOrigin({
      connectionType: null,
      createdByUserId: 5,
      ipAddress: null,
      isOfficeNetwork: false,
      latitude: null,
      longitude: null,
    });
    expect(result.tone).toBe("default");
    expect(result.label).toBe("Correccion admin");
  });

  it("returns sin red detectable when no IP at all", () => {
    const result = getAttendanceNetworkOrigin({
      connectionType: null,
      createdByUserId: null,
      ipAddress: null,
      isOfficeNetwork: false,
      latitude: null,
      longitude: null,
    });
    expect(result.tone).toBe("default");
    expect(result.label).toBe("Sin red detectable");
  });

  it("returns wifi external for wifi connection type", () => {
    const result = getAttendanceNetworkOrigin({
      connectionType: "WiFi",
      createdByUserId: null,
      ipAddress: "200.1.2.3",
      isOfficeNetwork: false,
      latitude: null,
      longitude: null,
    });
    expect(result.tone).toBe("warning");
    expect(result.label).toBe("Wi-Fi externa");
  });

  it("returns movil external for mobile connection type", () => {
    const result = getAttendanceNetworkOrigin({
      connectionType: "4G",
      createdByUserId: null,
      ipAddress: "200.1.2.3",
      isOfficeNetwork: false,
      latitude: null,
      longitude: null,
    });
    expect(result.tone).toBe("warning");
    expect(result.label).toBe("Movil externa");
  });

  it("returns red externa for unknown connection type with IP", () => {
    const result = getAttendanceNetworkOrigin({
      connectionType: "ethernet",
      createdByUserId: null,
      ipAddress: "10.0.0.5",
      isOfficeNetwork: false,
      latitude: null,
      longitude: null,
    });
    expect(result.tone).toBe("warning");
    expect(result.label).toBe("Red externa");
  });
});
