import { Button, Card, Chip, EmptyState } from "@heroui/react";
import { WaTableSkeleton } from "../components/Skeletons";
import { BarChart3, MessageSquareText, RefreshCw, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { SelectInput } from "@/features/outreach/components/FormField";
import { useAccounts, useConversationAnalyticsExtended } from "../hooks/useWaCloud";

const RANGES: { value: "7d" | "30d" | "90d"; label: string; days: number }[] = [
  { value: "7d", label: "Últimos 7 días", days: 7 },
  { value: "30d", label: "Últimos 30 días", days: 30 },
  { value: "90d", label: "Últimos 90 días", days: 90 },
];

const CATEGORY_COLORS: Record<string, "success" | "warning" | "accent" | "default" | "danger"> = {
  AUTHENTICATION: "warning",
  MARKETING: "accent",
  SERVICE: "success",
  UTILITY: "default",
};

export function WaCloudAnalyticsPage() {
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const accountOptions = useMemo(
    () => [
      { value: "", label: "Selecciona una cuenta WABA" },
      ...(accounts.data?.accounts ?? []).map((a) => ({
        value: String(a.id),
        label: a.displayName ?? a.wabaId,
      })),
    ],
    [accounts.data]
  );

  const { startUnix, endUnix } = useMemo(() => {
    const days = RANGES.find((r) => r.value === range)?.days ?? 30;
    const end = Math.floor(Date.now() / 1000);
    const start = end - days * 24 * 60 * 60;
    return { startUnix: start, endUnix: end };
  }, [range]);

  const analytics = useConversationAnalyticsExtended(
    accountId
      ? {
          accountId: Number(accountId),
          startUnix,
          endUnix,
          granularity: "DAILY",
          includePricing: true,
        }
      : null
  );

  const points = useMemo(() => analytics.data?.conversation ?? [], [analytics.data]);
  const pricing = analytics.data?.pricing ?? [];

  const totals = useMemo(() => {
    let convs = 0;
    let cost = 0;
    const byCategory: Record<string, number> = {};
    const byDirection: Record<string, number> = {};
    const byCountry: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    for (const p of points) {
      convs += p.conversation;
      cost += p.cost ?? 0;
      if (p.conversation_category) {
        byCategory[p.conversation_category] =
          (byCategory[p.conversation_category] ?? 0) + p.conversation;
      }
      if (p.conversation_direction) {
        byDirection[p.conversation_direction] =
          (byDirection[p.conversation_direction] ?? 0) + p.conversation;
      }
      if (p.country) {
        byCountry[p.country] = (byCountry[p.country] ?? 0) + p.conversation;
      }
      const day = new Date(p.start * 1000).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + p.conversation;
    }
    const sortedDays = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
    const maxDay = Math.max(1, ...sortedDays.map(([, v]) => v));
    return { convs, cost, byCategory, byDirection, byCountry, sortedDays, maxDay };
  }, [points]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Card>
        <Card.Header className="flex items-center justify-between">
          <div>
            <Card.Title>Conversaciones (Meta Cloud API)</Card.Title>
            <Card.Description>
              Métricas tomadas de <code>/conversation_analytics</code>. Una "conversación" es una
              ventana de 24h facturada.
            </Card.Description>
          </div>
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label="Refrescar"
            isPending={analytics.isFetching}
            onPress={() => analytics.refetch()}
          >
            <RefreshCw size={14} />
          </Button>
        </Card.Header>
        <Card.Content className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SelectInput
              label="Cuenta WABA"
              value={accountId}
              onValueChange={setAccountId}
              options={accountOptions}
            />
            <SelectInput
              label="Rango"
              value={range}
              onValueChange={(v) => setRange(v as "7d" | "30d" | "90d")}
              options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
            />
          </div>
        </Card.Content>
      </Card>

      {!accountId ? (
        <Card>
          <Card.Content className="p-8">
            <EmptyState className="text-center">
              <BarChart3 size={48} className="mx-auto text-default-300" />
              <p className="mt-3 font-semibold text-base">Selecciona una cuenta WABA</p>
              <p className="mt-1 text-default-500 text-sm">
                Las analíticas se cargan desde Meta. Pueden tardar unos segundos.
              </p>
            </EmptyState>
          </Card.Content>
        </Card>
      ) : analytics.isLoading ? (
        <Card>
          <WaTableSkeleton rows={8} cols={6} />
        </Card>
      ) : analytics.error ? (
        <Card>
          <Card.Content className="p-6 text-danger text-sm">
            Error: {String(analytics.error)}
          </Card.Content>
        </Card>
      ) : points.length === 0 ? (
        <Card>
          <Card.Content className="p-8 text-center text-default-500 text-sm">
            Sin datos para este rango.
          </Card.Content>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              icon={<MessageSquareText size={18} className="text-success" />}
              label="Conversaciones"
              value={totals.convs.toLocaleString("es-CL")}
            />
            <KpiCard
              icon={<TrendingUp size={18} className="text-accent" />}
              label="Costo USD"
              value={totals.cost.toFixed(2)}
            />
            <KpiCard
              icon={<BarChart3 size={18} className="text-warning" />}
              label="Días con tráfico"
              value={String(totals.sortedDays.length)}
            />
          </div>

          <Card>
            <Card.Header>
              <Card.Title className="text-sm">Por categoría</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-wrap gap-2">
              {Object.keys(totals.byCategory).length === 0 ? (
                <span className="text-default-400 text-xs">Sin desglose por categoría</span>
              ) : (
                Object.entries(totals.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, n]) => (
                    <Chip
                      key={cat}
                      size="md"
                      color={CATEGORY_COLORS[cat] ?? "default"}
                      variant="soft"
                    >
                      <Chip.Label>
                        {cat}: <strong className="ml-1">{n}</strong>
                      </Chip.Label>
                    </Chip>
                  ))
              )}
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-sm">Por dirección</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-wrap gap-2">
              {Object.keys(totals.byDirection).length === 0 ? (
                <span className="text-default-400 text-xs">Sin desglose</span>
              ) : (
                Object.entries(totals.byDirection)
                  .sort(([, a], [, b]) => b - a)
                  .map(([d, n]) => (
                    <Chip key={d} size="md" color="default" variant="soft">
                      <Chip.Label>
                        {d}: <strong className="ml-1">{n}</strong>
                      </Chip.Label>
                    </Chip>
                  ))
              )}
            </Card.Content>
          </Card>

          {Object.keys(totals.byCountry).length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title className="text-sm">Por país</Card.Title>
              </Card.Header>
              <Card.Content className="flex flex-wrap gap-2">
                {Object.entries(totals.byCountry)
                  .sort(([, a], [, b]) => b - a)
                  .map(([c, n]) => (
                    <Chip key={c} size="md" color="default" variant="soft">
                      <Chip.Label>
                        {c}: <strong className="ml-1">{n}</strong>
                      </Chip.Label>
                    </Chip>
                  ))}
              </Card.Content>
            </Card>
          )}

          <Card>
            <Card.Header>
              <Card.Title className="text-sm">Tendencia diaria</Card.Title>
            </Card.Header>
            <Card.Content>
              <div className="space-y-1.5">
                {totals.sortedDays.map(([day, n]) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 font-mono text-default-500 text-xs">{day}</span>
                    <div className="flex-1">
                      <div
                        className="h-5 rounded-r-md bg-success"
                        style={{ width: `${(n / totals.maxDay) * 100}%`, minWidth: "2px" }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-medium text-sm">{n}</span>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>

          <PricingPanel pricing={pricing} />
        </div>
      )}
    </div>
  );
}

function PricingPanel({
  pricing,
}: {
  pricing: Array<{
    start: number;
    end: number;
    volume: number;
    cost?: number | null;
    pricing_category?: string | null;
    country?: string | null;
    pricing_type?: string | null;
    tier?: string | null;
  }>;
}) {
  const byCategory: Record<string, { volume: number; cost: number }> = {};
  const byCountry: Record<string, { volume: number; cost: number }> = {};
  const byTier: Record<string, number> = {};
  const byPricingType: Record<string, number> = {};
  let totalCost = 0;
  let totalVolume = 0;

  for (const p of pricing) {
    totalCost += p.cost ?? 0;
    totalVolume += p.volume;
    if (p.pricing_category) {
      const k = p.pricing_category;
      byCategory[k] = byCategory[k] ?? { volume: 0, cost: 0 };
      byCategory[k].volume += p.volume;
      byCategory[k].cost += p.cost ?? 0;
    }
    if (p.country) {
      const k = p.country;
      byCountry[k] = byCountry[k] ?? { volume: 0, cost: 0 };
      byCountry[k].volume += p.volume;
      byCountry[k].cost += p.cost ?? 0;
    }
    if (p.tier) byTier[p.tier] = (byTier[p.tier] ?? 0) + p.volume;
    if (p.pricing_type)
      byPricingType[p.pricing_type] = (byPricingType[p.pricing_type] ?? 0) + p.volume;
  }

  if (pricing.length === 0) {
    return (
      <Card>
        <Card.Header>
          <Card.Title className="text-sm">Pricing breakdown (Meta)</Card.Title>
        </Card.Header>
        <Card.Content className="text-default-400 text-xs">Sin datos de pricing aún.</Card.Content>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title className="text-sm">Pricing breakdown (Meta)</Card.Title>
        <Card.Description>
          Total {totalVolume} conversaciones · USD {totalCost.toFixed(2)}
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <BreakdownGrid title="Por categoría" rows={byCategory} />
        <BreakdownGrid title="Por país" rows={byCountry} />
        <div>
          <p className="mb-1 font-medium text-default-700 text-xs uppercase">Por tier</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byTier).length === 0 ? (
              <span className="text-default-400 text-xs">—</span>
            ) : (
              Object.entries(byTier)
                .sort(([, a], [, b]) => b - a)
                .map(([k, v]) => (
                  <Chip key={k} size="sm" color="default" variant="soft">
                    <Chip.Label>
                      {k}: <strong className="ml-1">{v}</strong>
                    </Chip.Label>
                  </Chip>
                ))
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 font-medium text-default-700 text-xs uppercase">Tipo</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byPricingType).length === 0 ? (
              <span className="text-default-400 text-xs">—</span>
            ) : (
              Object.entries(byPricingType)
                .sort(([, a], [, b]) => b - a)
                .map(([k, v]) => (
                  <Chip key={k} size="sm" color="accent" variant="soft">
                    <Chip.Label>
                      {k}: <strong className="ml-1">{v}</strong>
                    </Chip.Label>
                  </Chip>
                ))
            )}
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

function BreakdownGrid({
  title,
  rows,
}: {
  title: string;
  rows: Record<string, { volume: number; cost: number }>;
}) {
  const entries = Object.entries(rows).sort(([, a], [, b]) => b.cost - a.cost);
  return (
    <div>
      <p className="mb-1 font-medium text-default-700 text-xs uppercase">{title}</p>
      {entries.length === 0 ? (
        <p className="text-default-400 text-xs">—</p>
      ) : (
        <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded bg-content2 px-2 py-1"
            >
              <span className="font-medium">{k}</span>
              <span className="font-mono text-default-600">
                {v.volume} convs · USD {v.cost.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <Card.Content className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-default-500 text-xs">
          {icon}
          <span>{label}</span>
        </div>
        <p className="font-bold text-2xl text-foreground">{value}</p>
      </Card.Content>
    </Card>
  );
}
