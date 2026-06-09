import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { CommerceCatalogCard } from "./CommerceCatalogCard";

// Card-level catalog manager. Needs QueryClient + MSW for listAccounts /
// listCommerceProducts / setCommerceCatalog. Stories cover: not linked
// yet, linked with products, linked with empty catalog, linked with
// many products + active search filter.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const ACCOUNTS_RESPONSE = {
  accounts: [
    {
      id: 1,
      wabaId: "104500000000001",
      metaBusinessId: "987654321",
      appId: "1234567890",
      graphApiVersion: "v22.0",
      displayName: "Bioalergia Principal",
      active: true,
      hasToken: true,
      hasAppSecret: true,
      hasVerifyToken: true,
      createdAt: new Date("2025-08-01T00:00:00Z"),
      updatedAt: new Date("2026-04-12T00:00:00Z"),
      phoneNumbers: [],
    },
  ],
};

const PRODUCTS = [
  {
    id: "prod-1",
    retailer_id: "BIO-INM-001",
    name: "Inmunoterapia subcutánea — primera dosis",
    description: "Frasco con vacuna individualizada",
    price: "45000",
    currency: "CLP",
    image_url: "https://placehold.co/200x200/png?text=INM-1",
    availability: "in stock",
  },
  {
    id: "prod-2",
    retailer_id: "BIO-INM-002",
    name: "Inmunoterapia subcutánea — mantención",
    description: "Frasco mantención",
    price: "35000",
    currency: "CLP",
    image_url: "https://placehold.co/200x200/png?text=INM-2",
    availability: "in stock",
  },
  {
    id: "prod-3",
    retailer_id: "BIO-CONS-001",
    name: "Consulta especialista alergología",
    description: null,
    price: "55000",
    currency: "CLP",
    image_url: "https://placehold.co/200x200/png?text=CONS",
    availability: "in stock",
  },
  {
    id: "prod-4",
    retailer_id: "BIO-EXAM-001",
    name: "Test cutáneo (prick test)",
    description: null,
    price: "28000",
    currency: "CLP",
    image_url: null,
    availability: "in stock",
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const baseHandlers = [
  http.post("*/api/orpc/wa-cloud/rpc/listAccounts", () => ok(ACCOUNTS_RESPONSE)),
  http.post("*/api/orpc/wa-cloud/rpc/setCommerceCatalog", () => ok({ status: "ok" })),
];

const meta: Meta<typeof CommerceCatalogCard> = {
  title: "WaCloud/CommerceCatalogCard",
  component: CommerceCatalogCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Card de configuración del catálogo Meta Commerce por cuenta WABA. Vincula un catalog id, lista productos (con búsqueda) y permite desvincular.",
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className="mx-auto max-w-4xl p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CommerceCatalogCard>;

export const NotLinked: Story = {
  name: "Sin catálogo vinculado",
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/wa-cloud/rpc/listCommerceProducts", () =>
          ok({ catalogId: null, products: [] })
        ),
      ],
    },
  },
};

export const LinkedWithProducts: Story = {
  name: "Catálogo vinculado — 4 productos",
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/wa-cloud/rpc/listCommerceProducts", () =>
          ok({ catalogId: "123456789012345", products: PRODUCTS })
        ),
      ],
    },
  },
};

export const LinkedEmptyCatalog: Story = {
  name: "Catálogo vinculado — sin productos",
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/wa-cloud/rpc/listCommerceProducts", () =>
          ok({ catalogId: "123456789012345", products: [] })
        ),
      ],
    },
  },
};
