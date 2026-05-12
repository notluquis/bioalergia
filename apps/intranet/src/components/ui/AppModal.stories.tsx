import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { AppModal } from "./AppModal";

const meta: Meta<typeof AppModal> = {
  title: "UI/AppModal",
  component: AppModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Shared shell over HeroUI v3 Modal compound. Mobile (<640px) slides up to fill viewport via `mobileFullscreen`. Desktop floats centered on `bg-content1`.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AppModal>;

function ModalDemo({
  size = "md",
  footer = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  footer?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir modal</Button>
      <AppModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Confirmar acción"
        size={size}
        footer={
          footer ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onPress={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onPress={() => setOpen(false)}>
                Aceptar
              </Button>
            </div>
          ) : undefined
        }
      >
        <p className="text-sm text-foreground">
          ¿Estás seguro de continuar con esta operación? Esta acción afecta los datos del paciente.
        </p>
      </AppModal>
    </div>
  );
}

export const Small: Story = { render: () => <ModalDemo size="sm" /> };
export const Medium: Story = { render: () => <ModalDemo size="md" /> };
export const Large: Story = { render: () => <ModalDemo size="lg" footer /> };
export const ExtraLarge: Story = { render: () => <ModalDemo size="xl" footer /> };
