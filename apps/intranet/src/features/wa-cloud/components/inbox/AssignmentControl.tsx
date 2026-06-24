import { Button, Chip } from "@heroui/react";
import { UserCheck, UserPlus, UserX } from "lucide-react";

// Shared-inbox ownership control in the conversation header. Avoids exposing
// colleague names (no users.list dependency / permission question) — it only
// distinguishes "mine" vs "someone else" vs "unassigned", which is enough to
// prevent two TENS from answering the same patient. Live "X está respondiendo"
// comes from the typing-presence SSE chip rendered alongside this.
export function AssignmentControl({
  assignedToUserId,
  currentUserId,
  onAssignToMe,
  onRelease,
  isPending,
}: {
  assignedToUserId: number | null;
  currentUserId: number | undefined;
  onAssignToMe: () => void;
  onRelease: () => void;
  isPending: boolean;
}) {
  const mine = assignedToUserId != null && assignedToUserId === currentUserId;
  const other = assignedToUserId != null && !mine;

  if (mine) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Chip size="sm" color="success" variant="soft">
          <UserCheck size={12} />
          <Chip.Label>Asignada a ti</Chip.Label>
        </Chip>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={onRelease}
          isPending={isPending}
          aria-label="Liberar asignación"
        >
          <UserX size={14} />
        </Button>
      </div>
    );
  }

  if (other) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Chip size="sm" color="warning" variant="soft">
          <Chip.Label>Asignada a otra persona</Chip.Label>
        </Chip>
        <Button size="sm" variant="secondary" onPress={onAssignToMe} isPending={isPending}>
          Tomar
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onPress={onAssignToMe}
      isPending={isPending}
      className="shrink-0"
    >
      <UserPlus size={14} />
      Asignármela
    </Button>
  );
}
