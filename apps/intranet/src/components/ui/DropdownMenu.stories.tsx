import { Dropdown, Label, Separator } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./Button";

const meta: Meta = {
  title: "UI/DropdownMenu",
};

export default meta;

type Story = StoryObj;

export const Basic: Story = {
  render: () => {
    const [compact, setCompact] = useState(false);

    return (
      <div className="flex h-40 items-start justify-start">
        <Dropdown>
          <Dropdown.Trigger>
            <Button variant="outline">Abrir menú</Button>
          </Dropdown.Trigger>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="Opciones" className="w-48">
              <Label>Preferencias</Label>
              <Separator />
              <Dropdown.Item>Perfil</Dropdown.Item>
              <Dropdown.Item>Notificaciones</Dropdown.Item>
              <Separator />
              <Dropdown.Item
                className="flex items-center justify-between gap-2"
                onPress={() => setCompact((prev) => !prev)}
              >
                <span>Modo compacto</span>
                {compact ? <span className="text-small">✓</span> : null}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    );
  },
};
