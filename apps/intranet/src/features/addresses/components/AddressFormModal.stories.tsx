import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import { AddressFormModal } from "./AddressFormModal";

// Stories for the patient address form. The modal calls Chilexpress via
// shipments.* (regions / communes / streets / street-numbers) and posts
// to addresses.create / addresses.update. Each story mocks the relevant
// procedures so the form renders the correct dropdowns and limits-alert
// without hitting the real Chilexpress sandbox.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const REGIONS = [
  { regionId: "RM", regionName: "METROPOLITANA DE SANTIAGO" },
  { regionId: "V", regionName: "VALPARAÍSO" },
  { regionId: "VIII", regionName: "BIOBÍO" },
];

const COMMUNES_RM = [
  {
    countyName: "Las Condes",
    coverageRegionCode: "LCON",
    supportsCashOnDelivery: true,
    supportsReturn: true,
    coverageName: null,
    ineCountyCode: 13114,
  },
  {
    countyName: "Providencia",
    coverageRegionCode: "PROV",
    supportsCashOnDelivery: true,
    supportsReturn: true,
    coverageName: null,
    ineCountyCode: 13123,
  },
  {
    countyName: "Puente Alto",
    coverageRegionCode: "PUEN",
    supportsCashOnDelivery: false,
    supportsReturn: true,
    coverageName: null,
    ineCountyCode: 13201,
  },
];

// Default Chilexpress fixtures — used by every story unless overridden.
const baseHandlers = [
  http.post("*/api/orpc/shipments/rpc/getRegions", () => ok({ regions: REGIONS })),
  http.post("*/api/orpc/shipments/rpc/getCommunes", () => ok({ communes: COMMUNES_RM })),
  http.post("*/api/orpc/shipments/rpc/searchStreets", () =>
    ok({
      streets: [
        { streetId: 1, streetName: "AV. APOQUINDO" },
        { streetId: 2, streetName: "AV. APOQUINDO ORIENTE" },
      ],
    })
  ),
  http.post("*/api/orpc/shipments/rpc/getStreetNumbers", () =>
    ok({
      numbers: [{ number: 4500 }, { number: 5000 }, { number: 5400 }, { number: 6000 }],
    })
  ),
  http.post("*/api/orpc/addresses/rpc/create", () =>
    ok({
      address: {
        id: 999,
        personId: 7,
        label: "Casa",
        street: "Av. Apoquindo",
        number: "5400",
        supplement: "Depto 802",
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
        chilexpressAddressId: 99001,
        countryCode: "CL",
        isPrimary: true,
        isActive: true,
        createdAt: new Date("2026-05-12T10:00:00Z").toISOString(),
        updatedAt: new Date("2026-05-12T10:00:00Z").toISOString(),
      },
    })
  ),
  http.post("*/api/orpc/addresses/rpc/update", () =>
    ok({
      address: {
        id: 101,
        personId: 7,
        label: "Casa",
        street: "Av. Apoquindo",
        number: "5400",
        supplement: "Depto 802",
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
        chilexpressAddressId: 99001,
        countryCode: "CL",
        isPrimary: true,
        isActive: true,
        createdAt: new Date("2025-10-10T00:00:00Z").toISOString(),
        updatedAt: new Date("2026-05-12T10:00:00Z").toISOString(),
      },
    })
  ),
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function CreateHarness() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir modal</Button>
      <AddressFormModal isOpen={open} onClose={() => setOpen(false)} personId={7} />
    </div>
  );
}

function EditHarness() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir modal</Button>
      <AddressFormModal
        isOpen={open}
        onClose={() => setOpen(false)}
        personId={7}
        draft={{
          id: 101,
          label: "Casa",
          street: "Av. Apoquindo",
          number: "5400",
          supplement: "Depto 802",
          reference: "Edificio Las Condes Park",
          postalCode: "7560864",
          regionCode: "RM",
          coverageCode: "LCON",
          isPrimary: true,
        }}
      />
    </div>
  );
}

const meta: Meta<typeof AddressFormModal> = {
  title: "Addresses/AddressFormModal",
  component: AddressFormModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Formulario de dirección estructurada con autocompletado de calle Chilexpress, validación de número en rango y alerta de cobertura cuando la comuna no admite contra-entrega o retorno de documentos.",
      },
    },
    msw: { handlers: baseHandlers },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AddressFormModal>;

// New address: empty form, regions loaded, comuna disabled until region
// picked.
export const CreateDefault: Story = {
  name: "Crear — formulario vacío",
  render: () => <CreateHarness />,
  // addon-vitest interaction — modal renders, dialog reachable to AT.
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    const dialog = await root.findByRole("dialog");
    await expect(dialog).toBeVisible();
  },
};

// Edit existing address: all fields prefilled from `draft`. Submit hits
// addresses.update.
export const EditExisting: Story = {
  name: "Editar — dirección existente",
  render: () => <EditHarness />,
};

// Edge case: comuna picked has supportsCashOnDelivery=false →
// ComunaLimitsAlert shows and "Guardar" stays disabled until the
// operator marks the acknowledgment checkbox.
export const ComunaWithLimits: Story = {
  name: "Crear — comuna con restricciones (Puente Alto)",
  render: () => <CreateHarness />,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        // Force every commune lookup to return only Puente Alto so the
        // limits alert is visible regardless of which region the user
        // selects in the dropdown.
        http.post("*/api/orpc/shipments/rpc/getCommunes", () =>
          ok({
            communes: [
              {
                countyName: "Puente Alto",
                coverageRegionCode: "PUEN",
                supportsCashOnDelivery: false,
                supportsReturn: false,
                coverageName: null,
                ineCountyCode: 13201,
              },
            ],
          })
        ),
      ],
    },
  },
};

// Backend rejects the create (e.g. duplicated label per person). Toast
// surfaces the error, modal stays open.
export const CreateError: Story = {
  name: "Crear — error del servidor",
  render: () => <CreateHarness />,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/addresses/rpc/create", () =>
          HttpResponse.json(
            {
              json: {
                code: "CONFLICT",
                message: "Ya existe una dirección con esa etiqueta para el paciente.",
                status: 409,
              },
              meta: [],
            },
            { status: 409 }
          )
        ),
      ],
    },
  },
};
