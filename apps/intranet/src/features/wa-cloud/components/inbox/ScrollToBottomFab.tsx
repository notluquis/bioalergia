import { Button } from "@heroui/react";
import { ChevronDown } from "lucide-react";

// Floating "go to latest" control over the message feed. Appears only when the
// operator has scrolled up; carries a count of messages that arrived while they
// were reading history so they know there's something new below.
export function ScrollToBottomFab({
  newCount,
  onPress,
}: {
  newCount: number;
  onPress: () => void;
}) {
  const label =
    newCount > 0
      ? `${newCount} ${newCount === 1 ? "mensaje nuevo" : "mensajes nuevos"}, ir al final`
      : "Ir al final";
  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-20">
      <div className="pointer-events-auto relative">
        <Button
          isIconOnly
          size="lg"
          variant="secondary"
          aria-label={label}
          onPress={onPress}
          className="size-11 rounded-full bg-content1 shadow-md ring-1 ring-default-200"
        >
          <ChevronDown size={20} />
        </Button>
        {newCount > 0 && (
          <span
            aria-hidden="true"
            className="-top-1 -right-1 absolute flex min-h-5 min-w-5 items-center justify-center rounded-full bg-success px-1 font-semibold text-success-foreground text-xs tabular-nums shadow"
          >
            {newCount > 99 ? "99+" : newCount}
          </span>
        )}
      </div>
    </div>
  );
}
