/**
 * Tests for shipments `api.ts` orpc wrappers (Chilexpress integration).
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock factory, module-boundary
 * mocking only (the orpc client), error-mapping coverage via
 * `toShipmentsApiError` (re-thrown as ApiError). Covers happy + error
 * paths for: quoting, address autocomplete (regions/communes/streets/
 * numbers), commercial offices, geocoding, transport order creation
 * (incl. cash-on-delivery + additional services), label reprint, and
 * tracking refresh.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  getRegions: vi.fn(),
  getCommunes: vi.fn(),
  getCommercialOffices: vi.fn(),
  getNearbyOffices: vi.fn(),
  searchStreets: vi.fn(),
  getStreetNumbers: vi.fn(),
  geocodeAddress: vi.fn(),
  reprintLabel: vi.fn(),
  trackShipment: vi.fn(),
  quote: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  listAll: vi.fn(),
}));

vi.mock("./orpc", async () => {
  const actual = await vi.importActual<typeof import("./orpc")>("./orpc");
  return {
    shipmentsORPCClient: orpcMocks,
    toShipmentsApiError: actual.toShipmentsApiError,
  };
});

const {
  fetchRegions,
  fetchCommunes,
  fetchCommercialOffices,
  fetchNearbyOffices,
  searchStreets,
  getStreetNumbers,
  geocodeAddress,
  reprintLabel,
  trackShipment,
  quoteShipment,
  createShipment,
  fetchShipments,
  fetchAllShipments,
} = await import("./api");
const { ApiError } = await import("@/lib/api-client");

describe("shipments/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("address autocomplete: regions / communes / streets", () => {
    it("fetchRegions calls getRegions with empty input", async () => {
      orpcMocks.getRegions.mockResolvedValue({ regions: [] });
      await fetchRegions();
      expect(orpcMocks.getRegions).toHaveBeenCalledWith({});
    });

    it("fetchCommunes forwards regionId and optional type", async () => {
      orpcMocks.getCommunes.mockResolvedValue({ communes: [] });
      await fetchCommunes("RM", "1");
      expect(orpcMocks.getCommunes).toHaveBeenCalledWith({ regionId: "RM", type: "1" });
    });

    it("fetchCommunes omits type when undefined", async () => {
      orpcMocks.getCommunes.mockResolvedValue({ communes: [] });
      await fetchCommunes("RM");
      expect(orpcMocks.getCommunes).toHaveBeenCalledWith({ regionId: "RM", type: undefined });
    });

    it("searchStreets forwards county + query", async () => {
      orpcMocks.searchStreets.mockResolvedValue({ streets: [] });
      await searchStreets({ countyName: "Providencia", query: "Av Providencia" });
      expect(orpcMocks.searchStreets).toHaveBeenCalledWith({
        countyName: "Providencia",
        query: "Av Providencia",
      });
    });

    it("getStreetNumbers forwards streetNameId", async () => {
      orpcMocks.getStreetNumbers.mockResolvedValue({ numbers: [] });
      await getStreetNumbers(12345);
      expect(orpcMocks.getStreetNumbers).toHaveBeenCalledWith({ streetNameId: 12345 });
    });

    it("wraps fetchRegions errors as ApiError", async () => {
      orpcMocks.getRegions.mockRejectedValue(new Error("chilexpress down"));
      await expect(fetchRegions()).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps searchStreets errors as ApiError", async () => {
      orpcMocks.searchStreets.mockRejectedValue(new Error("404"));
      await expect(
        searchStreets({ countyName: "Las Condes", query: "Apoquindo" })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("commercial offices", () => {
    it("fetchCommercialOffices forwards regionCode + countyName + type", async () => {
      orpcMocks.getCommercialOffices.mockResolvedValue({ offices: [] });
      await fetchCommercialOffices({
        regionCode: "RM",
        countyName: "Providencia",
        type: "0",
      });
      expect(orpcMocks.getCommercialOffices).toHaveBeenCalledWith({
        regionCode: "RM",
        countyName: "Providencia",
        type: "0",
      });
    });

    it("fetchNearbyOffices forwards addressId", async () => {
      orpcMocks.getNearbyOffices.mockResolvedValue({ offices: [] });
      await fetchNearbyOffices(987);
      expect(orpcMocks.getNearbyOffices).toHaveBeenCalledWith({ addressId: 987 });
    });

    it("wraps fetchNearbyOffices errors", async () => {
      orpcMocks.getNearbyOffices.mockRejectedValue(new Error("invalid address"));
      await expect(fetchNearbyOffices(1)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("geocodeAddress", () => {
    it("forwards full address payload", async () => {
      orpcMocks.geocodeAddress.mockResolvedValue({ lat: -33.4, lng: -70.6 });
      await geocodeAddress({
        streetName: "Av Apoquindo",
        countyName: "Las Condes",
        number: "4501",
      });
      expect(orpcMocks.geocodeAddress).toHaveBeenCalledWith({
        streetName: "Av Apoquindo",
        countyName: "Las Condes",
        number: "4501",
      });
    });

    it("wraps geocoding errors", async () => {
      orpcMocks.geocodeAddress.mockRejectedValue(new Error("not found"));
      await expect(
        geocodeAddress({ streetName: "X", countyName: "Y", number: "1" })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("quoteShipment", () => {
    it("forwards full quote payload", async () => {
      orpcMocks.quote.mockResolvedValue({ price: 5990, services: [] });
      const input = {
        originCoverageCode: "STGO",
        destinationCoverageCode: "VINA",
        weight: 1.5,
        height: 10,
        width: 10,
        length: 10,
        declaredValue: 25000,
      };
      await quoteShipment(input);
      expect(orpcMocks.quote).toHaveBeenCalledWith(input);
    });

    it("wraps quote errors as ApiError", async () => {
      orpcMocks.quote.mockRejectedValue(new Error("invalid coverage"));
      await expect(
        quoteShipment({
          originCoverageCode: "X",
          destinationCoverageCode: "Y",
          weight: 1,
          height: 1,
          width: 1,
          length: 1,
          declaredValue: 0,
        })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("createShipment (transport order)", () => {
    it("forwards minimal home-delivery order", async () => {
      orpcMocks.create.mockResolvedValue({ shipmentId: 42, trackingNumber: "CX123" });
      const input = {
        patientId: 1,
        deliveryMode: "home" as const,
        addressId: 99,
        serviceTypeCode: "1",
        serviceDescription: "Express",
        destinationCoverageCode: "STGO",
        recipientName: "Juan Pérez",
        recipientPhone: "+56912345678",
        weight: 1,
        height: 10,
        width: 10,
        length: 10,
        declaredValue: 10000,
        cashOnDelivery: 0,
        contentDescription: "Medicamentos",
      };
      await createShipment(input);
      expect(orpcMocks.create).toHaveBeenCalledWith(input);
    });

    it("forwards office pickup + cash-on-delivery + additional services", async () => {
      orpcMocks.create.mockResolvedValue({ shipmentId: 43, trackingNumber: "CX124" });
      const input = {
        patientId: 2,
        deliveryMode: "office" as const,
        commercialOfficeId: "OF-007",
        commercialOfficeName: "Sucursal Providencia",
        serviceTypeCode: "3",
        serviceDescription: "Estándar",
        destinationCoverageCode: "PROV",
        recipientName: "María González",
        recipientPhone: "+56987654321",
        recipientEmail: "maria@example.cl",
        weight: 2,
        height: 15,
        width: 15,
        length: 15,
        declaredValue: 50000,
        cashOnDelivery: 45000,
        contentDescription: "Vacunas refrigeradas",
        additionalServiceCodes: [101, 202],
        additionalServicesCost: 1500,
      };
      await createShipment(input);
      expect(orpcMocks.create).toHaveBeenCalledWith(input);
      expect(orpcMocks.create.mock.calls[0]?.[0]?.cashOnDelivery).toBe(45000);
      expect(orpcMocks.create.mock.calls[0]?.[0]?.additionalServiceCodes).toEqual([101, 202]);
    });

    it("wraps create errors as ApiError", async () => {
      orpcMocks.create.mockRejectedValue(new Error("chilexpress 500"));
      await expect(
        createShipment({
          patientId: 1,
          serviceTypeCode: "1",
          serviceDescription: "x",
          destinationCoverageCode: "STGO",
          recipientName: "x",
          recipientPhone: "+56900000000",
          weight: 1,
          height: 1,
          width: 1,
          length: 1,
          declaredValue: 0,
          cashOnDelivery: 0,
          contentDescription: "x",
        })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("reprintLabel + trackShipment", () => {
    it("reprintLabel forwards shipmentId", async () => {
      orpcMocks.reprintLabel.mockResolvedValue({ pdfBase64: "…" });
      await reprintLabel(7);
      expect(orpcMocks.reprintLabel).toHaveBeenCalledWith({ shipmentId: 7 });
    });

    it("trackShipment forwards shipmentId", async () => {
      orpcMocks.trackShipment.mockResolvedValue({ events: [] });
      await trackShipment(7);
      expect(orpcMocks.trackShipment).toHaveBeenCalledWith({ shipmentId: 7 });
    });

    it("wraps reprintLabel errors", async () => {
      orpcMocks.reprintLabel.mockRejectedValue(new Error("label not found"));
      await expect(reprintLabel(99)).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps trackShipment errors", async () => {
      orpcMocks.trackShipment.mockRejectedValue(new Error("network"));
      await expect(trackShipment(99)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("list endpoints", () => {
    it("fetchShipments forwards patientId", async () => {
      orpcMocks.list.mockResolvedValue({ shipments: [] });
      await fetchShipments(123);
      expect(orpcMocks.list).toHaveBeenCalledWith({ patientId: 123 });
    });

    it("fetchAllShipments uses empty input", async () => {
      orpcMocks.listAll.mockResolvedValue({ shipments: [] });
      await fetchAllShipments();
      expect(orpcMocks.listAll).toHaveBeenCalledWith({});
    });

    it("wraps list errors", async () => {
      orpcMocks.list.mockRejectedValue(new Error("boom"));
      await expect(fetchShipments(1)).rejects.toBeInstanceOf(ApiError);
    });
  });
});
