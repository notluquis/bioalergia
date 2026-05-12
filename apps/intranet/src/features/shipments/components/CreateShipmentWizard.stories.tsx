import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import { CreateShipmentWizard } from "./CreateShipmentWizard";

// Stories for the Chilexpress shipment wizard. Each story exercises one
// step with realistic Chilean fixtures so the UI can be reviewed end to
// end without hitting the real Chilexpress sandbox or DB.
//
// MSW notes:
//   * The default handlers in .storybook/msw-handlers.ts cover patients,
//     addresses and a generic catch-all. We override per-story for the
//     shipment-specific procedures (`getRegions`, `getCommunes`,
//     `getCommercialOffices`, `getNearbyOffices`, `quote`, `create`).
//   * Response envelope is the SuperJSON shape oRPC expects:
//     `{ json: <data>, meta: [] }`.
//   * The contract uses camelCase methods (`getRegions`), which translates
//     to URL `/api/orpc/shipments/rpc/getRegions`.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const PATIENT_DETAIL = {
  id: 42,
  personId: 7,
  birthDate: null,
  bloodType: null,
  notes: null,
  createdAt: new Date("2025-09-01T00:00:00Z"),
  updatedAt: new Date("2026-04-12T00:00:00Z"),
  attachments: [],
  budgets: [],
  consultations: [],
  medicalCertificates: [],
  payments: [],
  person: {
    id: 7,
    rut: "16.987.654-3",
    names: "Camila Andrea",
    fatherName: "Soto",
    motherName: "Vera",
    email: "camila.soto@example.cl",
    phone: "+56 9 8765 4321",
    personType: "NATURAL",
    createdAt: new Date("2025-09-01T00:00:00Z"),
    updatedAt: new Date("2026-04-12T00:00:00Z"),
  },
};

const ADDRESSES = [
  {
    id: 101,
    personId: 7,
    label: "Casa",
    street: "Av. Apoquindo",
    number: "5400",
    supplement: "Depto 802",
    reference: "Edificio Las Condes Park",
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
    updatedAt: new Date("2026-04-01T00:00:00Z").toISOString(),
  },
  {
    id: 102,
    personId: 7,
    label: "Trabajo",
    street: "Av. Providencia",
    number: "1200",
    supplement: null,
    reference: null,
    postalCode: "7500000",
    comuna: "Providencia",
    region: "Metropolitana",
    coverageCode: "PROV",
    regionCode: "RM",
    ineRegionCode: 13,
    ineCountyCode: 13123,
    supportsCashOnDelivery: true,
    supportsReturn: true,
    latitude: -33.42,
    longitude: -70.61,
    chilexpressAddressId: null,
    countryCode: "CL",
    isPrimary: false,
    isActive: true,
    createdAt: new Date("2025-11-15T00:00:00Z").toISOString(),
    updatedAt: new Date("2025-11-15T00:00:00Z").toISOString(),
  },
];

const REGIONS = [
  { regionId: "RM", regionName: "METROPOLITANA DE SANTIAGO" },
  { regionId: "V", regionName: "VALPARAÍSO" },
  { regionId: "VIII", regionName: "BIOBÍO" },
];

const COMMUNES = [
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

const OFFICES = [
  {
    commercialOfficeId: "CX-LC-01",
    commercialOfficeName: "Sucursal Las Condes Apoquindo",
    officeType: 0,
    street: "Av. Apoquindo",
    number: "4500",
    complement: "Local 12",
    commune: "Las Condes",
    region: "RM",
    regionCode: "RM",
    countyCode: "LCON",
    phone: "+56 2 2345 6789",
    services: [
      { serviceTypeCode: 3, serviceDescription: "Express", serviceStatusCode: 1 },
      { serviceTypeCode: 4, serviceDescription: "Prioritario", serviceStatusCode: 1 },
    ],
    businessHour: [
      { day: "Lunes", initialStartHour: "09:00", initialEndHour: "18:00" },
      { day: "Martes", initialStartHour: "09:00", initialEndHour: "18:00" },
      { day: "Miercoles", initialStartHour: "09:00", initialEndHour: "18:00" },
      { day: "Jueves", initialStartHour: "09:00", initialEndHour: "18:00" },
      { day: "Viernes", initialStartHour: "09:00", initialEndHour: "18:00" },
      { day: "Sabado", initialStartHour: "10:00", initialEndHour: "14:00" },
      { day: "Domingo", initialStartHour: "", initialEndHour: "" },
    ],
  },
  {
    commercialOfficeId: "CX-LC-02",
    commercialOfficeName: "Sucursal Las Condes Estoril",
    officeType: 0,
    street: "Av. Estoril",
    number: "120",
    complement: null,
    commune: "Las Condes",
    region: "RM",
    regionCode: "RM",
    countyCode: "LCON",
    phone: "0",
    services: [{ serviceTypeCode: 3, serviceDescription: "Express", serviceStatusCode: 1 }],
    businessHour: [
      { day: "Lunes", initialStartHour: "10:00", initialEndHour: "19:00" },
      { day: "Martes", initialStartHour: "10:00", initialEndHour: "19:00" },
      { day: "Miercoles", initialStartHour: "10:00", initialEndHour: "19:00" },
      { day: "Jueves", initialStartHour: "10:00", initialEndHour: "19:00" },
      { day: "Viernes", initialStartHour: "10:00", initialEndHour: "19:00" },
    ],
  },
];

const NEARBY_OFFICES = {
  offices: [
    {
      distance: 0.8,
      office: {
        commercialOfficeId: "CX-LC-01",
        commercialOfficeName: "Sucursal Las Condes Apoquindo",
        street: "Av. Apoquindo",
        number: "4500",
        commune: "Las Condes",
        regionCode: "RM",
        countyCode: "LCON",
      },
    },
    {
      distance: 1.6,
      office: {
        commercialOfficeId: "CX-LC-02",
        commercialOfficeName: "Sucursal Las Condes Estoril",
        street: "Av. Estoril",
        number: "120",
        commune: "Las Condes",
        regionCode: "RM",
        countyCode: "LCON",
      },
    },
  ],
};

const QUOTE_RESPONSE = {
  services: [
    {
      serviceTypeCode: "3",
      serviceDescription: "Express",
      serviceValue: 4990,
      deliveryTime: "Entrega en 24 horas hábiles",
      didUseVolumetricWeight: false,
      finalWeight: 0.2,
      conditions: "",
      deliveryType: 0,
      additionalServices: [],
    },
    {
      serviceTypeCode: "5",
      serviceDescription: "Prioritario",
      serviceValue: 6890,
      deliveryTime: "Entrega en 48 horas hábiles",
      didUseVolumetricWeight: true,
      finalWeight: 0.3,
      conditions: "",
      deliveryType: 0,
      additionalServices: [
        {
          serviceTypeCode: 99,
          serviceDescription: "Cobertura Extendida",
          serviceValue: 600,
          required: false,
        },
      ],
    },
  ],
};

const CREATE_RESPONSE = {
  shipment: {
    id: 555,
    patientId: 42,
    otNumber: "CX-9988776",
    serviceTypeCode: "3",
    serviceDescription: "Express",
    serviceFullDesc: "Express 24h",
    cashOnDelivery: 0,
    declaredValue: 60000,
    weight: 0.2,
    height: 5,
    width: 12,
    length: 20,
    recipientName: "Camila Andrea Soto",
    recipientPhone: "+56 9 8765 4321",
    recipientEmail: "camila.soto@example.cl",
    commercialOfficeId: "CX-LC-01",
    commercialOfficeName: "Sucursal Las Condes Apoquindo",
    coverageCode: "LCON",
    contentDescription: "Vacuna inmunoterapia",
    certificateNumber: null,
    reference: null,
    barcode: "100123456789",
    labelBase64: null,
    labelType: null,
    trackingStatus: null,
    trackingUpdatedAt: null,
    status: "CREATED",
    createdAt: new Date("2026-05-12T10:00:00Z"),
    updatedAt: new Date("2026-05-12T10:00:00Z"),
  },
  otNumber: "CX-9988776",
  barcode: "100123456789",
  certificateNumber: null,
  labelBase64: null,
};

// Shared MSW handlers for the wizard. Per-story `parameters.msw.handlers`
// extend or override these.
const shipmentsHandlers = [
  http.post("*/api/orpc/patients/rpc/detail", () => ok({ patient: PATIENT_DETAIL })),
  http.post("*/api/orpc/addresses/rpc/list", () => ok({ addresses: ADDRESSES })),
  http.post("*/api/orpc/shipments/rpc/getRegions", () => ok({ regions: REGIONS })),
  http.post("*/api/orpc/shipments/rpc/getCommunes", () => ok({ communes: COMMUNES })),
  http.post("*/api/orpc/shipments/rpc/getCommercialOffices", () => ok({ offices: OFFICES })),
  http.post("*/api/orpc/shipments/rpc/getNearbyOffices", () => ok(NEARBY_OFFICES)),
  http.post("*/api/orpc/shipments/rpc/quote", () => ok(QUOTE_RESPONSE)),
  http.post("*/api/orpc/shipments/rpc/create", () => ok(CREATE_RESPONSE)),
];

// Each story uses a fresh QueryClient so cached state from the previous
// story doesn't leak between renders during a `pnpm test:storybook` run.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function WizardHarness() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir wizard</Button>
      <CreateShipmentWizard
        isOpen={open}
        onClose={() => setOpen(false)}
        patientId={42}
        patientName="Camila Andrea Soto Vera"
      />
    </div>
  );
}

const meta: Meta<typeof CreateShipmentWizard> = {
  title: "Shipments/CreateShipmentWizard",
  component: CreateShipmentWizard,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Wizard de despacho ChileExpress: cobertura → cotizar → datos destinatario → confirmar → OT generada. MSW intercepta cada llamada al contrato shipments/addresses/patients para que el flujo se pueda recorrer sin backend real.",
      },
    },
    msw: { handlers: shipmentsHandlers },
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
type Story = StoryObj<typeof CreateShipmentWizard>;

// Step 1 (default landing): home delivery picker with two patient
// addresses, primary = Las Condes Apoquindo (full Chilexpress coverage).
export const StepCoverageHome: Story = {
  name: "1. Cobertura — domicilio (default)",
  render: () => <WizardHarness />,
};

// Step 1 alternate: no addresses on file → empty-state CTA to add one.
export const StepCoverageNoAddresses: Story = {
  name: "1. Cobertura — sin direcciones",
  render: () => <WizardHarness />,
  parameters: {
    msw: {
      handlers: [
        ...shipmentsHandlers,
        http.post("*/api/orpc/addresses/rpc/list", () => ok({ addresses: [] })),
      ],
    },
  },
};

// Step 1 alternate: office pickup mode. Region + comuna preloaded so the
// office radio list is rendered alongside the "cerca del domicilio"
// nearby-office shortcuts.
export const StepCoverageOffice: Story = {
  name: "1. Cobertura — sucursal Chilexpress",
  render: () => <WizardHarness />,
};

// Step 2: live quote returning two services. The cheaper one (Express)
// gets auto-selected and tagged "Más barato"; Prioritario shows
// volumetric-weight + opcional Cobertura Extendida.
export const StepQuote: Story = {
  name: "2. Cotizar — dos servicios disponibles",
  render: () => <WizardHarness />,
};

// Step 2 alternate: Chilexpress returns no services for the dimensions
// (out of coverage / over-weight). UI surfaces "sin cobertura" hint and
// blocks Continuar.
export const StepQuoteNoCoverage: Story = {
  name: "2. Cotizar — sin cobertura",
  render: () => <WizardHarness />,
  parameters: {
    msw: {
      handlers: [
        ...shipmentsHandlers,
        http.post("*/api/orpc/shipments/rpc/quote", () => ok({ services: [] })),
      ],
    },
  },
};

// Step 3: recipient form prefilled from patient detail (name/phone/email
// pulled from `fetchPatient`), prepaid by default.
export const StepRecipient: Story = {
  name: "3. Datos del destinatario",
  render: () => <WizardHarness />,
};

// Step 4: confirmation screen with the full review table. Submitting
// resolves to `CREATE_RESPONSE` and advances to "done".
export const StepConfirm: Story = {
  name: "4. Confirmar y generar OT",
  render: () => <WizardHarness />,
};

// Step 4 alternate: backend rejects the OT (Chilexpress 422). Mutation
// surfaces the error inline and the operator can go Atrás.
export const StepConfirmError: Story = {
  name: "4. Confirmar — error al crear OT",
  render: () => <WizardHarness />,
  parameters: {
    msw: {
      handlers: [
        ...shipmentsHandlers,
        http.post("*/api/orpc/shipments/rpc/create", () =>
          HttpResponse.json(
            {
              json: {
                code: "BAD_REQUEST",
                message: "Chilexpress rechazó la OT: dirección sin número válido.",
                status: 422,
              },
              meta: [],
            },
            { status: 422 }
          )
        ),
      ],
    },
  },
};

// Step 5: terminal success state with OT number + (optional) label
// download button.
export const StepDone: Story = {
  name: "5. Listo — OT generada",
  render: () => <WizardHarness />,
};
