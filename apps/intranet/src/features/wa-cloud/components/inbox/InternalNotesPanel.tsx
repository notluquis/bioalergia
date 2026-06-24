import { Button, Popover, TextArea } from "@heroui/react";
import { StickyNote } from "lucide-react";
import { useEffect, useState } from "react";

// Team-only notes on a conversation (never sent to the patient). Surfaced as a
// header button with a dot when notes exist — handy for shift handoffs between
// TENS/nurses. Persists to WaConversation.notas via updateConversation.
export function InternalNotesPanel({
  notas,
  onSave,
  isPending,
}: {
  notas: string | null;
  onSave: (value: string) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(notas ?? "");
  useEffect(() => setDraft(notas ?? ""), [notas]);
  const hasNotes = Boolean(notas?.trim());
  const dirty = draft.trim() !== (notas ?? "").trim();

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          size="sm"
          variant={hasNotes ? "secondary" : "ghost"}
          isIconOnly
          aria-label={
            hasNotes ? "Notas internas del equipo (con contenido)" : "Notas internas del equipo"
          }
          className="relative"
        >
          <StickyNote size={15} />
          {hasNotes && (
            <span
              aria-hidden="true"
              className="-top-0.5 -right-0.5 absolute size-2 rounded-full bg-warning"
            />
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Content className="rounded-2xl border border-default-200 bg-background p-2 shadow-lg">
        <Popover.Dialog aria-label="Notas internas del equipo" className="w-80 space-y-2 p-1">
          <div className="flex items-center gap-2 font-medium text-sm">
            <StickyNote size={14} className="text-warning" />
            Notas internas
            <span className="rounded-full bg-default-100 px-1.5 py-0.5 text-default-500 text-xs">
              solo equipo
            </span>
          </div>
          <p className="text-default-500 text-xs">
            No se envían al paciente. Úsalas para traspasos de turno y contexto clínico.
          </p>
          <TextArea
            variant="secondary"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            rows={5}
            fullWidth
            aria-label="Notas internas"
            placeholder="Ej: paciente ansioso por el examen; confirmar receta con Dra. mañana…"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onPress={() => onSave(draft.trim())}
              isPending={isPending}
              isDisabled={!dirty}
            >
              Guardar
            </Button>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
