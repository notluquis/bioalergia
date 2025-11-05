import { useNavigate } from "react-router-dom";
import Button from "../../../components/Button";

export default function ShortcutCard({
  title,
  description,
  to,
  accent,
}: {
  title: string;
  description: string;
  to: string;
  accent: "primary" | "secondary";
}) {
  const accentClass = accent === "primary" ? "text-primary" : "text-secondary";

  return (
    <article className="flex flex-col justify-between p-6 bg-base-100">
      <div>
        <h2 className={`text-lg font-semibold ${accentClass}`}>{title}</h2>
        <p className="mt-2 text-sm text-base-content/90">{description}</p>
      </div>
      <ShortcutButton to={to} />
    </article>
  );
}

function ShortcutButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <Button type="button" variant="primary" onClick={() => navigate(to)} className="mt-5">
      Abrir
    </Button>
  );
}
