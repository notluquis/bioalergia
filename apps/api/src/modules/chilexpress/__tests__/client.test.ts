import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  georeferenceAddress,
  getCommercialOffices,
  getCommunes,
  getNearbyOffices,
  getRegions,
  getStreetNumbers,
  reprintLabel,
  searchStreets,
  trackTransportOrder,
} from "../client";

const cfg = {
  coverageApiKey: "k1",
  ratingApiKey: "k2",
  ordersApiKey: "k3",
  clientRut: "76000000-0",
  originCoverageCode: "CONC",
  sandbox: true,
};

function mockJson(payload: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? "OK" : "ERR",
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(JSON.stringify(payload)),
  } as unknown as Response);
}

describe("chilexpress client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("getRegions reads top-level regions[]", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({ regions: [{ regionId: "R8", regionName: "BIOBIO", ineRegionCode: 8 }] }),
    );
    const r = await getRegions(cfg);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ regionId: "R8", regionName: "BIOBIO" });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      "testservices.wschilexpress.com/georeference/api/v1.0/regions",
    );
  });

  it("getCommunes(type=2) requests sub-sectors", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        coverageAreas: [
          {
            countyCode: "LIND",
            countyName: "BUIN",
            regionCode: "RM",
            coverageName: "BUIN - LINDEROS",
            ind_ppd: 1,
            ind_rd: 1,
          },
        ],
      }),
    );
    const r = await getCommunes(cfg, "RM", 2);
    expect(r[0]).toMatchObject({
      countyCode: "LIND",
      coverageRegionCode: "LIND",
      coverageName: "BUIN - LINDEROS",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/coverage-areas?RegionCode=RM&type=2");
  });

  it("getCommunes maps ind_ppd / ind_rd to capability flags", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        coverageAreas: [
          {
            countyCode: "PROV",
            countyName: "PROVIDENCIA",
            regionCode: "RM",
            ineCountyCode: 610,
            coverageName: "PROVIDENCIA",
            ind_ppd: 1,
            ind_rd: 0,
          },
        ],
      }),
    );
    const c = await getCommunes(cfg, "RM");
    expect(c[0]).toMatchObject({
      countyCode: "PROV",
      regionId: "RM",
      coverageRegionCode: "PROV",
      supportsCashOnDelivery: true,
      supportsReturn: false,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/coverage-areas?RegionCode=RM&type=1");
  });

  it("getCommercialOffices uses /offices?Type=0 and exposes services + businessHour", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        offices: [
          {
            addressId: 7159420,
            officeName: "CONCEPCION MAIPU DOS",
            officeType: 3,
            countyName: "CONCEPCION",
            regionName: "BIOBIO",
            regionCode: "R8",
            streetName: "MAIPU",
            streetNumber: 583,
            telephone: "41 2460026",
            managerName: "LUIS",
            latitude: "-36.82",
            longitude: "-73.05",
            businessHour: [
              {
                day: "Lunes",
                initialStartHour: "09:00",
                initialEndHour: "18:00",
                finalStartHour: "",
                finalEndHour: "",
              },
            ],
            officeServices: [
              { serviceTypeCode: 1, serviceDescription: "Envíos", serviceStatusCode: 1 },
            ],
          },
        ],
      }),
    );
    const offices = await getCommercialOffices(cfg, {
      regionCode: "R8",
      countyName: "CONCEPCION",
    });
    expect(offices[0]).toMatchObject({
      commercialOfficeId: "7159420",
      officeType: 3,
      manager: "LUIS",
      phone: "41 2460026",
      latitude: -36.82,
      longitude: -73.05,
    });
    expect(offices[0]?.services[0]?.serviceDescription).toBe("Envíos");
    expect(offices[0]?.businessHour[0]?.day).toBe("Lunes");
    expect(offices[0]?.schedules).toContain("Lunes: 09:00-18:00");
    expect(fetchSpy.mock.calls[0]?.[0]).toContain(
      "/offices?Type=0&RegionCode=R8&CountyName=CONCEPCION",
    );
  });

  it("getCommercialOffices Type=4 forwards as Type=4", async () => {
    fetchSpy.mockReturnValueOnce(mockJson({ offices: [] }));
    await getCommercialOffices(cfg, {
      regionCode: "R8",
      countyName: "CONCEPCION",
      type: 4,
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/offices?Type=4");
  });

  it("getNearbyOffices threads addressId in path", async () => {
    fetchSpy.mockReturnValueOnce(mockJson({ nearbyOffice: [] }));
    await getNearbyOffices(cfg, 7159420);
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/nearby-offices/7159420");
  });

  it("getNearbyOffices accepts singular nearbyOffice key from spec", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        nearbyOffice: [
          {
            distance: "566.31",
            office: {
              addressId: 1,
              officeName: "X",
              officeType: 3,
              countyName: "C",
              regionName: "R",
              streetName: "S",
              streetNumber: 1,
              businessHour: [],
              officeServices: [],
            },
          },
        ],
      }),
    );
    const r = await getNearbyOffices(cfg, 1);
    expect(r).toHaveLength(1);
    expect(r[0]?.distance).toBe("566.31");
  });

  it("searchStreets POSTs with countyName + streetName body", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        streets: [{ streetId: 1, streetName: "MAIPU", countyName: "CONCEPCION", roadType: "CALLE" }],
      }),
    );
    const r = await searchStreets(cfg, { countyName: "CONCEPCION", query: "MAI" });
    expect(r[0]).toMatchObject({ streetId: 1, streetName: "MAIPU" });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/streets/search?limit=25");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      countyName: "CONCEPCION",
      streetName: "MAI",
      pointsOfInterestEnabled: true,
      streetNameEnabled: true,
    });
  });

  it("getStreetNumbers reads streetNumbers[] with number + lat/lng", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        streetNumbers: [
          { number: 583, latitude: -33.44, longitude: -70.65, addressId: 7159420 },
        ],
      }),
    );
    const r = await getStreetNumbers(cfg, 1);
    expect(r[0]).toMatchObject({
      number: 583,
      latitude: -33.44,
      longitude: -70.65,
      addressId: 7159420,
    });
  });

  it("georeferenceAddress returns null when statusCode !== 0", async () => {
    fetchSpy.mockReturnValueOnce(mockJson({ statusCode: 1 }));
    const r = await georeferenceAddress(cfg, {
      streetName: "MAIPU",
      countyName: "CONCEPCION",
      number: "583",
    });
    expect(r).toBeNull();
  });

  it("georeferenceAddress returns coords on success", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        data: { latitude: "-36.82", longitude: "-73.05", addressId: 999 },
        statusCode: 0,
      }),
    );
    const r = await georeferenceAddress(cfg, {
      streetName: "MAIPU",
      countyName: "CONCEPCION",
      number: "583",
    });
    expect(r).toEqual({ latitude: "-36.82", longitude: "-73.05", addressId: 999 });
  });

  it("reprintLabel posts transportOrderNumber + parses label", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        statusCode: 0,
        data: {
          detail: { transportOrderNumber: "OT123", reference: "ref", barcode: "BC1" },
          label: "BASE64==",
        },
      }),
    );
    const r = await reprintLabel(cfg, { transportOrderNumber: "OT123" });
    expect(r).toMatchObject({ label: "BASE64==", barcode: "BC1", reference: "ref" });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/transport-orders-labels");
  });

  it("reprintLabel throws when statusCode !== 0", async () => {
    fetchSpy.mockReturnValueOnce(mockJson({ statusCode: 1, statusDescription: "nope" }));
    await expect(reprintLabel(cfg, { transportOrderNumber: "OT123" })).rejects.toThrow(/nope/);
  });

  it("trackTransportOrder maps event fields", async () => {
    fetchSpy.mockReturnValueOnce(
      mockJson({
        data: {
          statusCodeReference: "DLV",
          statusDescription: "Entregado",
          events: [{ eventDate: "2026-05-08", eventName: "Entregado", eventLocation: "Conce" }],
        },
      }),
    );
    const r = await trackTransportOrder(cfg, "OT123");
    expect(r.statusDescription).toBe("Entregado");
    expect(r.events[0]).toMatchObject({
      date: "2026-05-08",
      name: "Entregado",
      location: "Conce",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("/tracking");
  });
});
