import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import { ToastProvider } from "@/context/ToastContext";
import { roleKeys } from "@/features/roles/queries";
import { AddUserFormContainer } from "./AddUserFormContainer";

// Stories for the admin "create user" (invite) form. On submit it POSTs to
// users.invite, which emails the new user a set-password link and returns
// { userId, emailed }. These stories pin the two branches of the onwards toast:
// emailed=true → success, emailed=false → actionable warning (resend hint).
//
// The people/roles reads are pre-seeded into the QueryClient cache so the form
// renders immediately (no on-mount MSW read race); MSW only handles the invite
// POST, which fires after the user submits and is always intercepted.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const ROLES = [
  { id: 1, name: "VIEWER", description: null, isSystem: true, permissions: [] },
  { id: 2, name: "Socio", description: null, isSystem: false, permissions: [] },
];

function makeSeededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY } },
  });
  // Pre-seed the on-mount reads so the form renders immediately without racing
  // the MSW worker: no linkable people + the roles list for the role Select.
  client.setQueryData(["people"], { denied: false, people: [] });
  client.setQueryData(roleKeys.lists().queryKey, ROLES);
  return client;
}

function Harness() {
  const [client] = useState(makeSeededClient);
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <div className="p-8">
          <AddUserFormContainer onCancel={() => {}} onCreated={() => {}} />
        </div>
      </ToastProvider>
    </QueryClientProvider>
  );
}

async function fillRequiredFieldsAndSubmit(canvasElement: HTMLElement) {
  const { userEvent, within } = await import("storybook/test");
  const root = within(canvasElement.ownerDocument.body);
  await userEvent.type(await root.findByPlaceholderText("Ej: Juan Andrés"), "Carla");
  await userEvent.type(root.getByPlaceholderText("Ej: Pérez"), "Díaz");
  await userEvent.type(root.getByPlaceholderText("Ej: González"), "Soto");
  await userEvent.type(root.getByPlaceholderText("12.345.678-9"), "11.111.111-1");
  await userEvent.type(root.getByPlaceholderText("usuario@bioalergia.cl"), "carla@bioalergia.cl");
  await userEvent.type(root.getByPlaceholderText("Ej: Enfermera, Administrativo"), "Enfermera");
  await userEvent.click(root.getByRole("button", { name: "Crear usuario" }));
  return root;
}

const meta: Meta<typeof AddUserFormContainer> = {
  title: "Users/AddUserFormContainer",
  component: AddUserFormContainer,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Formulario admin para crear un usuario. Al enviar, el backend le manda un correo con enlace para definir su contraseña; el toast refleja si el correo salió (emailed).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AddUserFormContainer>;

// Renders the empty form (people pre-seeded, roles via MSW).
export const Default: Story = {
  name: "Formulario vacío",
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await expect(await root.findByPlaceholderText("usuario@bioalergia.cl")).toBeVisible();
    await expect(root.getByRole("button", { name: "Crear usuario" })).toBeVisible();
  },
};

// Happy path: invite succeeds and the email went out → success toast.
export const InviteEmailed: Story = {
  name: "Invita — correo enviado",
  render: () => <Harness />,
  parameters: {
    msw: {
      handlers: [http.post("*/api/orpc/users/rpc/invite", () => ok({ userId: 42, emailed: true }))],
    },
  },
  play: async ({ canvasElement }) => {
    const { expect, waitFor } = await import("storybook/test");
    const root = await fillRequiredFieldsAndSubmit(canvasElement);
    await waitFor(() => expect(root.getByText(/se le envió un correo/i)).toBeInTheDocument());
  },
};

// User created but the email bounced → actionable warning toast (resend hint).
export const InviteEmailFailed: Story = {
  name: "Invita — correo falló",
  render: () => <Harness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/users/rpc/invite", () => ok({ userId: 42, emailed: false })),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const { expect, waitFor } = await import("storybook/test");
    const root = await fillRequiredFieldsAndSubmit(canvasElement);
    await waitFor(() => expect(root.getByText(/no se pudo enviar/i)).toBeInTheDocument());
  },
};
