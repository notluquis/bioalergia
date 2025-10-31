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
  const accentColor = accent === "primary" ? "var(--brand-primary)" : "var(--brand-secondary)";
  const accentTint = accent === "primary" ? "rgba(14, 100, 183, 0.15)" : "rgba(241, 167, 34, 0.18)";

  return (
    <article className="flex flex-col justify-between p-6 bg-base-100">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: accentColor }}>
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600/90">{description}</p>
      </div>
      <ShortcutButton to={to} accentColor={accentColor} accentTint={accentTint} />
    </article>
  );
}

function ShortcutButton({ to }: { to: string; accentColor: string; accentTint: string }) {
  const navigate = useNavigate();
  return (
    <Button type="button" variant="primary" onClick={() => navigate(to)} className="mt-5">
      Abrir
    </Button>
  );
}
