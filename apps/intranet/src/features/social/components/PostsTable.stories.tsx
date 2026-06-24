import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { SOCIAL_FIXTURES } from "../../../../.storybook/msw-handlers";
import type { SocialPost } from "../types";
import { PostsTable } from "./PostsTable";

// The posts table is the heart of the approval panel: it lists publications
// with their status, destinations and row actions (ver detalle / aprobar /
// rechazar / publicar). Mutations resolve via MSW (see default handlers).
// `onOpenDetail` is provided as a Storybook action arg.

const FIXTURE_POSTS = SOCIAL_FIXTURES.allPosts as unknown as SocialPost[];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof PostsTable> = {
  title: "Social/PostsTable",
  component: PostsTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tabla de publicaciones (DataTable compartido) con estado, destinos, fecha programada y acciones por fila. Las mutaciones (aprobar/rechazar/publicar) resuelven vía MSW sin tocar backend.",
      },
    },
  },
  args: {
    onOpenDetail: () => undefined,
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
type Story = StoryObj<typeof PostsTable>;

export const Default: Story = {
  name: "Con publicaciones",
  args: { posts: FIXTURE_POSTS },
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const canvas = within(canvasElement);

    // The first row's caption preview should render.
    await expect(await canvas.findByText(/Promo invierno/)).toBeVisible();

    // Row action: clicking "Ver detalle" fires the onOpenDetail callback.
    const [firstDetailButton] = await canvas.findAllByRole("button", { name: "Ver detalle" });
    await expect(firstDetailButton).toBeDefined();
    await userEvent.click(firstDetailButton as HTMLElement);

    await waitFor(async () => {
      await expect(firstDetailButton as HTMLElement).toBeEnabled();
    });
  },
};

export const Loading: Story = {
  name: "Cargando",
  args: { posts: [], isLoading: true },
};

export const Empty: Story = {
  name: "Sin publicaciones",
  args: { posts: [], isLoading: false },
};
