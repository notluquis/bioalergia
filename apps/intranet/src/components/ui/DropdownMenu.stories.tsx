import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./Button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownPopover,
  HeroDropdownMenu,
} from "./DropdownMenu";

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
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline">Abrir menú</Button>
          </DropdownMenuTrigger>
          <DropdownPopover>
            <HeroDropdownMenu aria-label="Opciones" className="w-48">
              <DropdownMenuLabel>Preferencias</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Notificaciones</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center justify-between gap-2"
                onPress={() => setCompact((prev) => !prev)}
              >
                <span>Modo compacto</span>
                {compact ? <span className="text-small">✓</span> : null}
              </DropdownMenuItem>
            </HeroDropdownMenu>
          </DropdownPopover>
        </DropdownMenu>
      </div>
    );
  },
};
