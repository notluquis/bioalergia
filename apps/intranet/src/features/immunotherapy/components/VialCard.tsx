import { Card, Chip, Tooltip } from "@heroui/react";
import { FlaskConical, Info, Syringe } from "lucide-react";
import type { Vial } from "../data/types";
import {
  FAMILY_CHIP_COLORS,
  FAMILY_LABELS,
  FORMULATION_CHIP_COLORS,
  FORMULATION_LABELS,
} from "../data/types";

interface VialCardProps {
  vial: Vial;
  index: number;
}

const SITE_LABELS = {
  brazo_derecho: "Brazo Derecho",
  brazo_izquierdo: "Brazo Izquierdo",
} as const;

export function VialCard({ vial, index }: VialCardProps) {
  const totalUg = vial.allergens.reduce((sum, e) => sum + (e.injectedUg ?? 0), 0);
  const showTotalUg = totalUg > 0;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both"
      style={{ animationDelay: `${index * 120}ms`, animationDuration: "500ms" }}
    >
      <Card className="overflow-hidden border border-default-200 transition-shadow hover:shadow-lg">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <Card.Header className="flex flex-row items-center justify-between gap-3 border-default-100 border-b bg-default-50 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FlaskConical size={18} />
            </div>
            <div>
              <Card.Title className="text-base leading-tight">Vial {vial.vialNumber}</Card.Title>
              <Card.Description className="text-xs">{vial.label}</Card.Description>
            </div>
          </div>

          <Chip color={FORMULATION_CHIP_COLORS[vial.formulation]} size="sm" variant="soft">
            {FORMULATION_LABELS[vial.formulation]}
          </Chip>
        </Card.Header>

        {/* ── Body: Allergen Breakdown ─────────────────────────────────── */}
        <Card.Content className="space-y-3 p-4">
          {vial.allergens.map((entry) => (
            <div
              key={entry.allergen.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-default-100 bg-default-50/50 p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground text-sm">{entry.allergen.name}</span>
                  {entry.isDominant && (
                    <Chip color="warning" size="sm" variant="soft">
                      Dominante
                    </Chip>
                  )}
                  <Chip color={FAMILY_CHIP_COLORS[entry.allergen.family]} size="sm" variant="soft">
                    {FAMILY_LABELS[entry.allergen.family]}
                  </Chip>
                </div>
                <p className="text-default-500 text-xs italic">{entry.allergen.scientificName}</p>
                <p className="text-default-600 text-xs">
                  Marcador: <span className="font-medium">{entry.allergen.molecularMarker}</span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-right">
                <div>
                  <p className="font-semibold text-foreground text-base tabular-nums">
                    {entry.doseDisplay}
                  </p>
                  <p className="text-default-400 text-xs">
                    en {vial.injectionVolumeMl} mL ·{" "}
                    {entry.allergen.molecularMarker.split("+")[0]?.trim() ??
                      entry.allergen.molecularMarker}
                  </p>
                </div>
                {entry.doseSource && (
                  <Tooltip>
                    <Tooltip.Trigger>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-default-400 transition-colors hover:text-default-600"
                        aria-label="Fuente de la dosis"
                      >
                        <Info size={13} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content className="max-w-xs">
                      <p className="text-sm">Fuente: {entry.doseSource}</p>
                    </Tooltip.Content>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </Card.Content>

        {/* ── Body: Alternative Presentations ───────────────────────────── */}
        {vial.equivalences && vial.equivalences.length > 0 && (
          <div className="border-default-100 border-t bg-default-50/30 px-4 py-3">
            <p className="mb-2 font-medium text-default-700 text-xs uppercase tracking-wider">
              Alternativas de Inyección
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {vial.equivalences.map((eq, i) => (
                <div
                  key={i}
                  className="flex flex-col rounded-lg border border-default-200 bg-background p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-default-900 text-sm">
                      {eq.formulationName}
                    </span>
                    <Chip size="sm" variant="soft" className="h-5 min-h-5 px-1.5 text-xs">
                      {eq.concentrationString}
                    </Chip>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-default-500 text-xs">
                    <span className="flex items-center gap-1">
                      <Syringe size={12} className="text-primary/70" />
                      Inyectar:{" "}
                      <strong className="text-default-700">{eq.requiredVolumeMl} mL</strong>
                    </span>
                    <span>
                      Rinde <strong className="text-default-700">{eq.dosesPerVial}</strong> dosis
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <Card.Footer className="flex flex-wrap items-center justify-between gap-3 border-default-100 border-t bg-default-50 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-default-600 text-sm">
              <Syringe size={14} className="text-primary" />
              <span className="font-medium">{vial.injectionVolumeMl} mL</span>
            </div>
            <div className="text-default-500 text-sm">{SITE_LABELS[vial.injectionSite]}</div>
            {showTotalUg && (
              <div className="font-semibold text-primary text-sm">
                Total: {totalUg.toLocaleString("es-CL", { maximumFractionDigits: 2 })} µg
              </div>
            )}
          </div>

          <Tooltip>
            <Tooltip.Trigger>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-default-400 text-xs transition-colors hover:bg-default-100 hover:text-default-600"
              >
                <Info size={14} />
                <span className="hidden sm:inline">Justificación</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-xs">
              <p className="text-sm">{vial.rationale}</p>
            </Tooltip.Content>
          </Tooltip>
        </Card.Footer>
      </Card>
    </div>
  );
}
