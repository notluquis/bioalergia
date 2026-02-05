import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
              <DropdownMenuCheckboxItem checked={compact} onCheckedChange={setCompact}>
                Modo compacto
              </DropdownMenuCheckboxItem>
            </HeroDropdownMenu>
          </DropdownPopover>
        </DropdownMenu>
      </div>
    );
  },
};
