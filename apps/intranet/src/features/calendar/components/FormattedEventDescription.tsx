import { cn } from "@/lib/utils";
import { formatEventDescriptionToPlainText } from "../utils/format-event-description";

interface FormattedEventDescriptionProps {
  className?: string;
  text: string;
}

export function FormattedEventDescription({
  className,
  text,
}: Readonly<FormattedEventDescriptionProps>) {
  const plainContent = formatEventDescriptionToPlainText(text);

  return (
    <div
      className={cn(
        "whitespace-pre-wrap font-normal text-foreground-500 text-xs leading-relaxed ",
        className
      )}
    >
      {plainContent}
    </div>
  );
}
