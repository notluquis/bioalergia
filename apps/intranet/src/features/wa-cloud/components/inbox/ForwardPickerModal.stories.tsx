import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { fn } from "storybook/test";

import { ForwardPickerModal } from "./ForwardPickerModal";

// Destination picker for forwarding a message. Opens as a HeroUI Modal (React
// Aria → portalled into document.body) and fetches candidate conversations via
// the `listConversations` oRPC procedure → needs MSW + a QueryClientProvider.
// Each row calls onForward(conversationId, phoneNumberId).

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

// Conversation list-item fixtures matching the contract shape the modal reads:
// id, contact.{name,pushName,phoneE164}, channelPhoneNumberIds[].
const FIXTURE_ITEMS = [
  {
    id: 501,
    contactId: 9001,
    status: "ABIERTA",
    assignedToUserId: null,
    unreadCount: 0,
    lastInboundAt: new Date("2026-06-17T10:00:00Z"),
    lastMessageAt: new Date("2026-06-17T10:05:00Z"),
    lastMessagePreview: "Gracias, doctora",
    notas: null,
    etiquetas: [],
    mutedUntil: null,
    contact: {
      id: 9001,
      phoneE164: "+56911111111",
      name: "María González",
      pushName: "Mari",
      optInStatus: "OPTED_IN",
      notas: null,
      etiquetas: [],
      patientRut: null,
      blockedAt: null,
      marketingOptIn: true,
      bsuid: null,
    },
    channelPhoneNumberIds: [10],
  },
  {
    id: 502,
    contactId: 9002,
    status: "ABIERTA",
    assignedToUserId: null,
    unreadCount: 2,
    lastInboundAt: new Date("2026-06-17T09:00:00Z"),
    lastMessageAt: new Date("2026-06-17T09:30:00Z"),
    lastMessagePreview: "¿A qué hora?",
    notas: null,
    etiquetas: [],
    mutedUntil: null,
    contact: {
      id: 9002,
      phoneE164: "+56922222222",
      name: null,
      pushName: "Juan Pérez",
      optInStatus: "OPTED_IN",
      notas: null,
      etiquetas: [],
      patientRut: null,
      blockedAt: null,
      marketingOptIn: null,
      bsuid: null,
    },
    channelPhoneNumberIds: [11],
  },
  {
    id: 503,
    contactId: 9003,
    status: "ABIERTA",
    assignedToUserId: null,
    unreadCount: 0,
    lastInboundAt: null,
    lastMessageAt: new Date("2026-06-16T18:00:00Z"),
    lastMessagePreview: null,
    notas: null,
    etiquetas: [],
    mutedUntil: null,
    contact: {
      id: 9003,
      phoneE164: "+56933333333",
      name: null,
      pushName: null,
      optInStatus: "OPTED_IN",
      notas: null,
      etiquetas: [],
      patientRut: null,
      blockedAt: null,
      marketingOptIn: null,
      bsuid: null,
    },
    channelPhoneNumberIds: [12],
  },
];

const meta: Meta<typeof ForwardPickerModal> = {
  title: "WaCloud/ForwardPickerModal",
  component: ForwardPickerModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Selector de conversación destino para reenviar un mensaje. Lista las conversaciones (listConversations) con buscador; cada fila reenvía a esa conversación.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/wa-cloud/rpc/listConversations", () =>
          ok({ items: FIXTURE_ITEMS, total: FIXTURE_ITEMS.length, page: 1, pageSize: 30 })
        ),
        // The modal only calls listConversations, but keep a generic success so
        // any stray oRPC POST resolves instead of erroring.
        http.post("*/api/orpc/*", () => ok({})),
      ],
    },
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
type Story = StoryObj<typeof ForwardPickerModal>;

const noop = () => {};

export const Open: Story = {
  name: "Abierto — 3 conversaciones",
  render: (args) => <ForwardPickerModal {...args} />,
  args: {
    isOpen: true,
    onClose: noop,
    onForward: fn(),
    isPending: false,
  },
  play: async ({ canvasElement, args }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    // Modal content is portalled into document.body — wait for the dialog.
    const dialog = await body.findByRole("dialog");
    await expect(dialog).toBeInTheDocument();
    const inDialog = within(dialog);

    // The three fixtures render their display name (name ?? pushName ?? phone).
    const first = await inDialog.findByText("María González");
    await expect(first).toBeInTheDocument();
    await expect(inDialog.getByText("Juan Pérez")).toBeInTheDocument();
    await expect(inDialog.getAllByText("+56933333333").length).toBeGreaterThan(0);

    // Clicking the first row forwards (conversationId, phoneNumberId).
    await userEvent.click(first);
    await expect(args.onForward).toHaveBeenCalledWith(501, 10);
  },
};
