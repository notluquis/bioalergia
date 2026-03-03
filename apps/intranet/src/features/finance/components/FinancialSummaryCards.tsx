import { Card, Skeleton } from "@heroui/react";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import type { FinancialSummary } from "../types";

interface FinancialSummaryCardsProps {
  summary: FinancialSummary | null;
  isLoading: boolean;
}

export function FinancialSummaryCards({
  summary,
  isLoading,
}: Readonly<FinancialSummaryCardsProps>) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div className="space-y-3 rounded-2xl border border-default-200 p-3" key={i}>
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-8 w-40 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="p-3" variant="secondary">
        <Card.Header className="items-center justify-between p-0">
          <Card.Title className="text-sm">Ingresos Totales</Card.Title>
          <DollarSign className="h-4 w-4 text-success" />
        </Card.Header>
        <Card.Content className="p-0 pt-2">
          <p className="font-semibold text-2xl text-success">
            ${summary.totalIncome.toLocaleString("es-CL")}
          </p>
          <Card.Description>Desde Calendario</Card.Description>
        </Card.Content>
      </Card>
      <Card className="p-3" variant="secondary">
        <Card.Header className="items-center justify-between p-0">
          <Card.Title className="text-sm">Gastos Totales</Card.Title>
          <TrendingDown className="h-4 w-4 text-danger" />
        </Card.Header>
        <Card.Content className="p-0 pt-2">
          <p className="font-semibold text-2xl text-danger">
            ${summary.totalExpense.toLocaleString("es-CL")}
          </p>
          <Card.Description>Proyectado</Card.Description>
        </Card.Content>
      </Card>
      <Card className="p-3" variant="secondary">
        <Card.Header className="items-center justify-between p-0">
          <Card.Title className="text-sm">Utilidad Neta</Card.Title>
          <TrendingUp className="h-4 w-4 text-primary" />
        </Card.Header>
        <Card.Content className="p-0 pt-2">
          <p className="font-semibold text-2xl text-primary">
            ${summary.netIncome.toLocaleString("es-CL")}
          </p>
          <Card.Description>Ingresos - Gastos</Card.Description>
        </Card.Content>
      </Card>
    </div>
  );
}
