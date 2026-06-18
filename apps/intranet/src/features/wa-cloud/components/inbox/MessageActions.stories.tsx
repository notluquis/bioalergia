import type { Meta, StoryObj } from "@storybook/react-vite";

import { MessageActionMenu, MessageActionSheet, type MessageActionsApi } from "./MessageActions";

// Desktop popover (MessageActionMenu) + touch bottom-sheet (MessageActionSheet)
// for per-message actions. Pure client-side: HeroUI Popover/Drawer (React Aria)
// portal their content into document.body, so the play() functions query the
// owning document and `findBy*`-wait for the portal to mount. The default
// play() deliberately does NOT click "+", which would lazy-import the heavy
// `EmojiPickerPanel` (frimousse) — that path is covered by EmojiPickerButton.

const meta: Meta<typeof MessageActionMenu> = {
  title: "WaCloud/MessageActions",
  component: MessageActionMenu,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          'Acciones de un mensaje WhatsApp. Menú de escritorio (popover, kebab) y hoja inferior táctil. Fila de reacciones rápidas (6 + "+") y filas Responder/Editar/Reenviar/Copiar/Reintentar según los permisos del mensaje.',
      },
    },
  },
};

export default meta;

// Full API — every action enabled, with an own reaction set so the toggle
// highlight (ring-2 ring-success + "Quitar reacción") is exercised.
const fullApi: MessageActionsApi = {
  canReact: true,
  canReply: true,
  canEdit: true,
  canForward: true,
  canRetry: true,
  canSaveSticker: false,
  body: "Confirmada tu hora del jueves a las 16:00. ¡Nos vemos!",
  ownReaction: "👍",
  onReact: () => {},
  onReply: () => {},
  onEdit: () => {},
  onForward: () => {},
  onRetry: () => {},
  onSaveSticker: () => {},
};

// Minimal API — a failed outbound message: only retry is offered.
const retryOnlyApi: MessageActionsApi = {
  canReact: false,
  canReply: false,
  canEdit: false,
  canForward: false,
  canRetry: true,
  canSaveSticker: false,
  body: null,
  ownReaction: null,
  onReact: () => {},
  onReply: () => {},
  onEdit: () => {},
  onForward: () => {},
  onRetry: () => {},
  onSaveSticker: () => {},
};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center p-8">{children}</div>;
}

type MenuStory = StoryObj<typeof MessageActionMenu>;

export const MenuFull: MenuStory = {
  name: "Menú escritorio — todas las acciones + reacción propia",
  render: () => (
    <Row>
      <MessageActionMenu api={fullApi} />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const body = within(doc.body);

    // Open the popover via the kebab trigger.
    const kebab = canvas.getByRole("button", { name: "Acciones del mensaje" });
    await userEvent.click(kebab);

    // Popover content is portalled into document.body — wait for it.
    const dialog = await body.findByRole("dialog", { name: "Acciones del mensaje" });
    await expect(dialog).toBeVisible();
    const inDialog = within(dialog);

    // Quick reactions present; the own reaction (👍) reads as "Quitar reacción".
    await expect(inDialog.getByRole("button", { name: "Quitar reacción 👍" })).toBeVisible();
    await expect(inDialog.getByRole("button", { name: "Reaccionar ❤️" })).toBeVisible();

    // Action rows present.
    await expect(inDialog.getByText("Responder")).toBeVisible();
    await expect(inDialog.getByText("Reintentar")).toBeVisible();

    // Close before the keyboard pass so the next open starts clean.
    await userEvent.keyboard("{Escape}");
    await body.findByRole("button", { name: "Acciones del mensaje" });

    // Keyboard: Tab focuses the kebab, Enter re-opens the popover.
    await userEvent.tab();
    await expect(kebab).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(await body.findByRole("dialog", { name: "Acciones del mensaje" })).toBeVisible();
  },
};

export const MenuRetryOnly: MenuStory = {
  name: "Menú escritorio — solo Reintentar",
  render: () => (
    <Row>
      <MessageActionMenu api={retryOnlyApi} />
    </Row>
  ),
};

type SheetStory = StoryObj<typeof MessageActionSheet>;

export const SheetOpen: SheetStory = {
  name: "Hoja táctil — abierta, todas las acciones",
  render: () => <MessageActionSheet open onOpenChange={() => {}} api={fullApi} />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const body = within(doc.body);

    const dialog = await body.findByRole("dialog", { name: "Acciones del mensaje" });
    await expect(dialog).toBeVisible();
    const inDialog = within(dialog);
    await expect(inDialog.getByText("Responder")).toBeVisible();
    await expect(inDialog.getByText("Reintentar")).toBeVisible();
  },
};
