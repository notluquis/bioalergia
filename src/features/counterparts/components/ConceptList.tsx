import { fmtCLP } from "../../../lib/format";

interface ConceptListProps {
  concepts: Array<[string, number]>;
}

export default function ConceptList({ concepts }: ConceptListProps) {
  if (!concepts.length) {
    return <p className="text-xs text-slate-600">No hay conceptos asignados.</p>;
  }
  const max = Math.max(...concepts.map(([, value]) => value));
  return (
    <div className="space-y-3">
      {concepts.map(([concept, value]) => {
        const width = max ? Math.max((value / max) * 100, 4) : 4;
        return (
          <div key={concept} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-700">{concept}</span>
              <span className="font-semibold text-[var(--brand-primary)]">{fmtCLP(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-white/60 bg-base-100/55">
              <div
                className="h-full rounded-full bg-[var(--brand-primary)]/70 shadow-[0_6px_16px_-12px_rgba(16,37,66,0.45)]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
