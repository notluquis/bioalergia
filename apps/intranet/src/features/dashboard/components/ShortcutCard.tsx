import { useNavigate } from "@tanstack/react-router";

import Button from "@/components/ui/Button";

export default function ShortcutCard({
  accent,
  description,
  title,
  to,
}: {
  accent: "primary" | "secondary";
  description: string;
  title: string;
  to: string;
}) {
  const accentClass = accent === "primary" ? "text-primary" : "text-secondary";

  return (
    <article className="surface-recessed flex flex-col justify-between p-6">
      <div>
        <h2 className={`text-lg font-semibold ${accentClass}`}>{title}</h2>
        <p className="text-foreground/90 mt-2 text-sm">{description}</p>
      </div>
      <ShortcutButton to={to} />
    </article>
  );
}

function ShortcutButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <Button className="mt-5" onClick={() => navigate({ to: to })} type="button" variant="primary">
      Abrir
    </Button>
  );
}
