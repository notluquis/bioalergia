import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { StickerPickerButton } from "./StickerPickerButton";

// Composer sticker tray. Desktop = HeroUI Popover (React Aria → portalled into
// document.body); the listing only fires while open (lazy), via the
// `listSavedStickers` oRPC procedure → needs MSW + a QueryClientProvider. Each
// sticker <img> hits the auth-gated media proxy, stubbed to a 1×1 PNG so the
// lazy <img> load doesn't 404 noisily.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });
const TRANSPARENT_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
  ),
  (c) => c.charCodeAt(0)
);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const STICKER_FIXTURES = [
  {
    id: 1,
    url: "/api/wa-cloud/media/saved-sticker/1",
    favorite: false,
    lastUsedAt: new Date("2026-06-17T10:00:00Z"),
    hitCount: 4,
  },
  {
    id: 2,
    url: "/api/wa-cloud/media/saved-sticker/2",
    favorite: true,
    lastUsedAt: new Date("2026-06-16T12:00:00Z"),
    hitCount: 2,
  },
  {
    id: 3,
    url: "/api/wa-cloud/media/saved-sticker/3",
    favorite: false,
    lastUsedAt: null,
    hitCount: 0,
  },
];

const meta: Meta<typeof StickerPickerButton> = {
  title: "WaCloud/StickerPickerButton",
  component: StickerPickerButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Bandeja de stickers del composer. Escritorio = popover; pestañas Recientes/Guardados; cuadrícula de stickers. El listado solo se consulta al abrir (lazy).",
      },
    },
    msw: {
      handlers: [
        http.get("*/api/wa-cloud/media/*", () =>
          HttpResponse.arrayBuffer(TRANSPARENT_PNG.buffer, {
            headers: { "Content-Type": "image/png" },
          })
        ),
        http.post("*/api/orpc/wa-cloud/rpc/listSavedStickers", () =>
          ok({ stickers: STICKER_FIXTURES })
        ),
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
type Story = StoryObj<typeof StickerPickerButton>;

const noop = () => {};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center p-8">{children}</div>;
}

export const Default: Story = {
  name: "Por defecto — abre la cuadrícula",
  render: () => (
    <Row>
      <StickerPickerButton accountId={1} isDisabled={false} onSend={noop} />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const body = within(doc.body);

    const trigger = canvas.getByRole("button", { name: "Stickers" });
    await userEvent.click(trigger);

    // Popover content portals into document.body — wait for the grid dialog.
    const dialog = await body.findByRole("dialog", { name: "Stickers" });
    await expect(dialog).toBeVisible();
    const inDialog = within(dialog);

    // Tabs are present, and a sticker button mounts once listSavedStickers
    // resolves (3 fixtures → 3 "Enviar sticker" buttons).
    await expect(inDialog.getByText("Recientes")).toBeVisible();
    const stickers = await inDialog.findAllByRole("button", { name: "Enviar sticker" });
    await expect(stickers.length).toBeGreaterThan(0);
  },
};

export const Disabled: Story = {
  name: "Deshabilitado — sin cuenta",
  render: () => (
    <Row>
      <StickerPickerButton accountId={undefined} isDisabled onSend={noop} />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Stickers" });
    await expect(trigger).toBeDisabled();
  },
};
