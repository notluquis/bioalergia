import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { confirmAction, ConfirmDialogHost } from "./ConfirmDialog";

const meta: Meta<typeof ConfirmDialogHost> = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialogHost,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Imperative replacement for `window.confirm()`. Mount `<ConfirmDialogHost />` once in the app tree, then call `confirmAction({...})` from anywhere. Returns a Promise<boolean>. Supports default/danger variants and an NHS-style typed-confirmation gate for high-risk destructive actions (`requireText`).",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ConfirmDialogHost>;

export const Default: Story = {
  render: () => (
    <div className="space-y-4 p-8">
      <Button
        variant="primary"
        onPress={() =>
          void confirmAction({
            title: "Guardar cambios",
            description: "Los cambios se aplicarán al expediente del paciente.",
          })
        }
      >
        Abrir confirmación (default)
      </Button>
      <ConfirmDialogHost />
    </div>
  ),
};

export const DangerVariant: Story = {
  render: () => (
    <div className="space-y-4 p-8">
      <Button
        variant="danger"
        onPress={() =>
          void confirmAction({
            title: "Eliminar dirección",
            description:
              "La dirección se eliminará permanentemente. Esta acción no se puede deshacer.",
            confirmLabel: "Eliminar",
            variant: "danger",
          })
        }
      >
        Abrir confirmación (danger)
      </Button>
      <ConfirmDialogHost />
    </div>
  ),
};

export const RequireTypedConfirmation: Story = {
  render: () => (
    <div className="space-y-4 p-8">
      <Button
        variant="danger"
        onPress={() =>
          void confirmAction({
            title: "Eliminar paciente",
            description:
              "Vas a eliminar permanentemente al paciente y su historial clínico completo.",
            confirmLabel: "Eliminar paciente",
            variant: "danger",
            requireText: "ELIMINAR",
            requireTextLabel: "Escribe ELIMINAR para confirmar",
          })
        }
      >
        Abrir confirmación con texto requerido
      </Button>
      <ConfirmDialogHost />
    </div>
  ),
};
