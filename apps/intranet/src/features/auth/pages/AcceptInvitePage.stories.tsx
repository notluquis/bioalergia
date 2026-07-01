import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import { AcceptInvitePage } from "./AcceptInvitePage";

// Stories for the admin invite-email landing. The token is single-use, so the
// page never consumes it on mount — activation is behind an explicit button
// press. States pinned here:
//   - no token in the URL      → invalid-link message + forgot-password link
//   - token present            → "Activar mi cuenta" button
//   - token + backend OK       → session refresh + redirect to /onboarding
//   - token + backend rejects  → inline "invitación no válida" error
//
// The page reads `useSearch({ from: "/accept-invite" })` and calls
// `useNavigate` / `useAuth`, so each story mounts it inside a real memory
// router (an /accept-invite route carrying the token in its search) wrapped
// in a QueryClient (useAuth's session query). MSW handles the acceptInvite
// POST and the session probe.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

// Clean session response so useAuth's refreshSession refetch resolves without
// noise (the global handler omits `status`, which the strict schema rejects).
const sessionHandler = http.post("*/api/orpc/auth/rpc/session", () =>
  ok({ status: "ok", user: null })
);

function makeClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  // Pre-seed so useAuth doesn't fire the session probe on mount.
  client.setQueryData(["auth", "session"], null);
  return client;
}

function buildRouter(token: string | undefined) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const acceptRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/accept-invite",
    validateSearch: (search: Record<string, unknown>) => ({
      token: typeof search.token === "string" ? search.token : undefined,
    }),
    component: AcceptInvitePage,
  });
  const forgotRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/forgot-password",
    component: () => <div>Recuperar contraseña</div>,
  });
  const onboardingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/onboarding",
    component: () => <div>Onboarding — cuenta activada</div>,
  });
  const initialUrl = token ? `/accept-invite?token=${token}` : "/accept-invite";
  return createRouter({
    routeTree: rootRoute.addChildren([acceptRoute, forgotRoute, onboardingRoute]),
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
}

function Harness({ token }: { token?: string }) {
  const [client] = useState(makeClient);
  const [router] = useState(() => buildRouter(token));
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

const meta: Meta<typeof AcceptInvitePage> = {
  title: "Auth/AcceptInvitePage",
  component: AcceptInvitePage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Landing del correo de invitación. La activación está detrás de un click explícito (el token es de un solo uso, no se consume al montar). Sin token muestra el aviso de enlace inválido con acceso a recuperar contraseña.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AcceptInvitePage>;

// No token in the URL → invalid-link copy + forgot-password link; no activate
// button.
export const NoToken: Story = {
  name: "Sin token — enlace inválido",
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await expect(await root.findByText(/el enlace no es válido/i)).toBeVisible();
    await expect(root.getByRole("link", { name: /recuperar contraseña/i })).toBeVisible();
    await expect(root.queryByRole("button", { name: /activar mi cuenta/i })).toBeNull();
  },
};

// Token present → activate button shown, not yet pressed.
export const WithToken: Story = {
  name: "Con token — botón activar",
  render: () => <Harness token="invite-token-abc" />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await expect(await root.findByRole("button", { name: /activar mi cuenta/i })).toBeVisible();
  },
};

// Token + backend accepts → session refresh, redirect to /onboarding.
export const ActivateSuccess: Story = {
  name: "Con token — activación exitosa",
  render: () => <Harness token="invite-token-abc" />,
  parameters: {
    msw: {
      handlers: [http.post("*/api/orpc/auth/rpc/acceptInvite", () => ok({})), sessionHandler],
    },
  },
  play: async ({ canvasElement }) => {
    const { expect, userEvent, waitFor, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await userEvent.click(await root.findByRole("button", { name: /activar mi cuenta/i }));
    await waitFor(() => expect(root.getByText(/cuenta activada/i)).toBeInTheDocument());
  },
};

// Token + backend rejects (expired / already used) → inline error, page stays.
export const ActivateFailed: Story = {
  name: "Con token — invitación inválida",
  render: () => <Harness token="expired-token" />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/auth/rpc/acceptInvite", () =>
          HttpResponse.json(
            {
              json: {
                code: "UNAUTHORIZED",
                message: "Invitación inválida o expirada",
                status: 401,
              },
              meta: [],
            },
            { status: 401 }
          )
        ),
        sessionHandler,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const { expect, userEvent, waitFor, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await userEvent.click(await root.findByRole("button", { name: /activar mi cuenta/i }));
    await waitFor(() =>
      expect(root.getByText(/la invitación no es válida o expiró/i)).toBeInTheDocument()
    );
  },
};
