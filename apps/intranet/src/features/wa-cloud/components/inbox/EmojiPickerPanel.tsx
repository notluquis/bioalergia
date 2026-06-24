import { EmojiPicker } from "frimousse";

// frimousse (~276 KB unpacked) is code-split out of the wa-cloud route bundle:
// this panel is lazy-loaded by EmojiPickerButton only when the popover opens,
// keeping the toolbar trigger instant and the initial chunk under budget.
// Default export so React.lazy can consume it directly.
export default function EmojiPickerPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <EmojiPicker.Root
      locale="es"
      className="isolate flex h-[380px] w-[320px] flex-col bg-background text-foreground"
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
    >
      <EmojiPicker.Search
        placeholder="Buscar emoji…"
        className="m-2 rounded-lg border border-default-200 bg-default-100 px-3 py-2 text-sm outline-none focus:border-success"
      />
      <EmojiPicker.Viewport className="relative flex-1 overflow-hidden">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-default-500 text-sm">
          Cargando…
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-default-500 text-sm">
          Sin resultados
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-2"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                className="bg-background px-2 py-1 font-medium text-default-500 text-xs"
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="scroll-my-1.5 px-1">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                className="flex size-8 items-center justify-center rounded-md text-xl data-[active]:bg-default-100"
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
