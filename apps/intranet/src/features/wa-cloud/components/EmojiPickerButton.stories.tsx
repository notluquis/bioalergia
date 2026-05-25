import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { EmojiPickerButton } from "./EmojiPickerButton";

// EmojiPickerButton wraps `frimousse` inside a HeroUI Popover. Pure
// client-side; no MSW needed. Stories show the trigger alone and
// inside a chat composer mock to validate width / placement.

const meta: Meta<typeof EmojiPickerButton> = {
  title: "WaCloud/EmojiPickerButton",
  component: EmojiPickerButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Botón de inserción de emoji para el composer del chat. Abre un picker buscable (locale es) y devuelve el carácter al callback.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof EmojiPickerButton>;

export const TriggerOnly: Story = {
  name: "Trigger aislado",
  render: () => (
    <div className="p-12">
      <EmojiPickerButton onSelect={() => {}} />
    </div>
  ),
};

export const InsideComposer: Story = {
  name: "Dentro del composer (texto + emoji)",
  render: () => {
    function Demo() {
      const [text, setText] = useState("Recordatorio para tu sesión de mañana ");
      return (
        <div className="w-[420px] rounded-2xl border border-default-200 bg-content1 p-2 shadow-sm">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1 rounded-lg bg-default-100 px-3 py-2 text-sm outline-none"
              placeholder="Escribe un mensaje…"
              aria-label="Mensaje"
            />
            <EmojiPickerButton onSelect={(e) => setText((t) => t + e)} />
          </div>
        </div>
      );
    }
    return (
      <div className="p-12">
        <Demo />
      </div>
    );
  },
};
