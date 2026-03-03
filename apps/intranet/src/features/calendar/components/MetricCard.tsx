import { Card, Description } from "@heroui/react";
import { cn } from "@/lib/utils";

type MetricTone = "default" | "error" | "primary" | "success" | "warning";
type MetricSize = "lg" | "md" | "sm";

interface MetricCardProps {
  className?: string;
  size?: MetricSize;
  subtitle?: string;
  suffix?: string;
  title: string;
  tone?: MetricTone;
  value: number | string;
}

const toneClassByMetric: Record<MetricTone, string> = {
  default: "text-foreground",
  error: "text-danger",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
};

const sizeClassByMetric: Record<MetricSize, { title: string; value: string }> = {
  lg: { title: "text-sm", value: "text-3xl font-bold" },
  md: { title: "text-xs", value: "text-2xl font-semibold" },
  sm: { title: "text-[10px]", value: "text-lg font-semibold" },
};

export function MetricCard({
  className,
  size = "md",
  subtitle,
  suffix,
  title,
  tone = "default",
  value,
}: Readonly<MetricCardProps>) {
  const sizeClasses = sizeClassByMetric[size];

  return (
    <Card className={cn("border border-default-200 bg-background shadow-sm", className)}>
      <Card.Content className="p-3">
        <Description
          className={cn(
            "font-semibold text-default-500 uppercase tracking-wide",
            sizeClasses.title,
          )}
        >
          {title}
        </Description>
        <p className={cn("mt-1", toneClassByMetric[tone], sizeClasses.value)}>
          {value}
          {suffix ? (
            <span className="ml-1 font-normal text-default-400 text-sm">{suffix}</span>
          ) : null}
        </p>
        {subtitle ? (
          <Description className="mt-1 text-default-400 text-xs">{subtitle}</Description>
        ) : null}
      </Card.Content>
    </Card>
  );
}
