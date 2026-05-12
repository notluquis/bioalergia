import { http, HttpResponse } from "msw";

/**
 * MSW handlers for Storybook + addon-vitest.
 *
 * Stories that exercise components which call oRPC (lists, wizards,
 * inbox panes) need a network mock — otherwise vitest browser tests
 * crash on the first `fetch('/api/orpc/…')` because nothing answers
 * and `csrfFetch` rejects.
 *
 * Three principles:
 *   1. **Never hit the real DB.** Every handler returns deterministic
 *      fixtures or a generic 200 success. No external network calls.
 *   2. **Destructive verbs return success without state change.**
 *      Buttons labeled "Eliminar", "Borrar", "Cancelar" can be clicked
 *      in stories with no DB risk because the underlying mutation
 *      resolves to a fake success here.
 *   3. **Match oRPC's wire shape.** All oRPC requests are POST to
 *      `/api/orpc/<namespace>/rpc/<procedure>`. The response body is
 *      the contract's output schema, serialized via SuperJSON.
 *
 * Extend with feature-specific fixtures inline next to the story:
 *   parameters: { msw: { handlers: [...defaults, http.post(...)] } }
 */

const ok = (data: unknown = { ok: true }) => HttpResponse.json({ json: data, meta: [] });

const SAMPLE_ADDRESS = {
  id: 1,
  personId: 1,
  label: "Principal",
  street: "Av. Apoquindo",
  number: "5000",
  supplement: "Of. 802",
  reference: null,
  postalCode: "7560864",
  comuna: "Las Condes",
  region: "Metropolitana",
  coverageCode: "LCON",
  regionCode: "RM",
  ineRegionCode: 13,
  ineCountyCode: 13114,
  supportsCashOnDelivery: true,
  supportsReturn: true,
  latitude: -33.4174,
  longitude: -70.6041,
  chilexpressAddressId: null,
  countryCode: "CL",
  isPrimary: true,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
};

const SAMPLE_PATIENT = {
  id: 1,
  person: {
    id: 1,
    rut: "12345678-9",
    names: "María José",
    fatherName: "Pérez",
    motherName: "González",
    email: "demo@bioalergia.cl",
    phone: "+56912345678",
  },
};

export const handlers = [
  // CSRF token — every csrfFetch fetches this first.
  http.get("*/api/csrf", () => HttpResponse.json({ token: "msw-fake-csrf" })),

  // Auth session probe.
  http.post("*/api/orpc/auth/rpc/session", () => ok({ user: SAMPLE_PATIENT.person })),

  // Addresses.
  http.post("*/api/orpc/addresses/rpc/list", () => ok({ addresses: [SAMPLE_ADDRESS] })),
  http.post("*/api/orpc/addresses/rpc/create", () => ok({ address: SAMPLE_ADDRESS })),
  http.post("*/api/orpc/addresses/rpc/update", () => ok({ address: SAMPLE_ADDRESS })),
  http.post("*/api/orpc/addresses/rpc/delete", () => ok({ ok: true })),

  // Patients.
  http.post("*/api/orpc/patients/rpc/detail", () => ok({ patient: SAMPLE_PATIENT })),
  http.post("*/api/orpc/patients/rpc/list", () => ok({ patients: [SAMPLE_PATIENT], total: 1 })),

  // Shipments (Chilexpress regions/communes/offices — small fixtures).
  http.post("*/api/orpc/shipments/rpc/regions", () =>
    ok({ regions: [{ regionId: "RM", regionName: "METROPOLITANA DE SANTIAGO" }] })
  ),
  http.post("*/api/orpc/shipments/rpc/communes", () =>
    ok({
      communes: [
        {
          countyName: "Las Condes",
          coverageRegionCode: "LCON",
          supportsCashOnDelivery: true,
        },
      ],
    })
  ),
  http.post("*/api/orpc/shipments/rpc/list", () => ok({ shipments: [] })),

  // Catchall: every other oRPC endpoint resolves to a generic success.
  // Destructive verbs (delete/cancel/send/broadcast) fall through to here
  // and complete the story interaction without hitting any real backend.
  http.post("*/api/orpc/*", () => ok({})),
  http.get("*/api/orpc/*", () => ok({})),
];
