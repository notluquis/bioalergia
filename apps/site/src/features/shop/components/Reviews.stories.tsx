import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import superjsonClass from "superjson";

import { SHOP_FIXTURES } from "../../../../.storybook/msw-handlers";
import { Reviews } from "./Reviews";

const superjson = superjsonClass as unknown as {
  serialize: (d: unknown) => { json: unknown; meta?: unknown };
};
const ok = (data: unknown) => HttpResponse.json(superjson.serialize(data));

// Reseñas de producto: agregado (estrellas + promedio), lista de reseñas y el
// formulario plegable para escribir una nueva. La query listReviews la responde
// el handler MSW global; aquí variamos sólo el estado vacío por-story.
const meta: Meta<typeof Reviews> = {
  title: "Shop/Reviews",
  component: Reviews,
  parameters: {
    layout: "padded",
    chromatic: { viewports: [1280, 390] },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof Reviews>;

export const WithReviews: Story = {
  args: { productId: 1 },
};

export const Empty: Story = {
  args: { productId: 1 },
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/catalog/rpc/listReviews", () => ok(SHOP_FIXTURES.reviewsEmpty)),
      ],
    },
  },
};
