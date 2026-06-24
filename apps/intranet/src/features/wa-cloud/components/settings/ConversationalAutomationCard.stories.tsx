import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { ConversationalAutomationCard } from "./ConversationalAutomationCard";

// Card-level editor for Meta's Conversational Automation. Needs a
// QueryClient (uses useAccounts + useConversationalAutomation) and MSW
// stubs for the wa-cloud namespace. Each story tweaks the
// getConversationalAutomation response to render a different state.

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
      phoneNumbers: [
        {
          id: 11,
          accountId: 1,
          phoneNumberId: "44988877766600",
          displayPhoneNumber: "+56 2 2345 6789",
          label: "Recepción",
          qualityRating: "GREEN",
          active: true,
        },
        {
          id: 12,
          accountId: 1,
          phoneNumberId: "44988877766601",
          displayPhoneNumber: "+56 9 8765 4321",
          label: "Inmunoterapia",
          qualityRating: "GREEN",
          active: true,
        },
      ],
    },
  ],
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const baseHandlers = [
  http.post("*/api/orpc/wa-cloud/rpc/listAccounts", () => ok(ACCOUNTS_RESPONSE)),
  http.post("*/api/orpc/wa-cloud/rpc/updateConversationalAutomation", () => ok({ status: "ok" })),
];

const meta: Meta<typeof ConversationalAutomationCard> = {
  title: "WaCloud/ConversationalAutomationCard",
  component: ConversationalAutomationCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Editor de Conversational Components de Meta: ice breakers (máx 4), commands (máx 30, slash menu) y mensaje de bienvenida. Estado local hasta apretar Guardar para no thrashear la API de Meta.",
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className="mx-auto max-w-3xl p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ConversationalAutomationCard>;

export const EmptyConfig: Story = {
  name: "Sin ice breakers ni commands",
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/wa-cloud/rpc/getConversationalAutomation", () =>
          ok({ enable_welcome_message: false, prompts: [], commands: [] })
        ),
      ],
    },
  },
};

export const PopulatedConfig: Story = {
  name: "Con bienvenida + 3 ice breakers + 4 commands",
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/wa-cloud/rpc/getConversationalAutomation", () =>
          ok({
            enable_welcome_message: true,
            prompts: [
              "Quiero agendar una consulta",
              "Necesito una receta",
              "Consultar resultados de exámenes",
            ],
            commands: [
              { command_name: "agendar", command_description: "Agendar consulta nueva" },
              { command_name: "horarios", command_description: "Ver horarios disponibles" },
              { command_name: "ubicacion", command_description: "Dirección y mapa" },
              { command_name: "humano", command_description: "Hablar con recepción" },
            ],
          })
        ),
      ],
    },
  },
};

export const MaxedOutPrompts: Story = {
  name: "4 ice breakers (botón Agregar bloqueado)",
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/wa-cloud/rpc/getConversationalAutomation", () =>
          ok({
            enable_welcome_message: false,
            prompts: [
              "Quiero agendar una consulta",
              "Necesito una receta",
              "Consultar resultados",
              "Hablar con recepción",
            ],
            commands: [],
          })
        ),
      ],
    },
  },
};
