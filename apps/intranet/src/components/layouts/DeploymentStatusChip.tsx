import { Chip, Skeleton, Tooltip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCan } from "@/hooks/use-can";
import { systemQueries } from "@/features/system/queries";
import type { RailwayDeploymentStatus, RailwayDeploymentTarget } from "@/features/system/types";

interface DeploymentStatusChipProps {
  compact?: boolean;
}

function isActiveStatus(status: RailwayDeploymentStatus) {
  return (
    status === "BUILDING" || status === "DEPLOYING" || status === "QUEUED" || status === "WAITING"
  );
}

function isProblemStatus(status: RailwayDeploymentStatus) {
  return status === "CRASHED" || status === "FAILED";
}

function statusLabel(status: RailwayDeploymentStatus) {
  switch (status) {
    case "BUILDING":
      return "build";
    case "CRASHED":
      return "crashed";
    case "DEPLOYING":
      return "deploy";
    case "FAILED":
      return "failed";
    case "QUEUED":
      return "queue";
    case "REMOVED":
      return "removed";
    case "SKIPPED":
      return "skipped";
    case "SLEEPING":
      return "sleep";
    case "SUCCESS":
      return "ok";
    case "WAITING":
      return "wait";
    default:
      return "n/d";
  }
}

function summaryLabel(targets: RailwayDeploymentTarget[], configured: boolean) {
  if (!configured) return "Deploy n/d";
  if (targets.some((target) => isProblemStatus(target.status))) return "Deploy con falla";
  const activeCount = targets.filter((target) => isActiveStatus(target.status)).length;
  if (activeCount > 0)
    return activeCount === 1 ? "Deploy en curso" : `${activeCount} deploys en curso`;
  return "Deploy estable";
}

function summaryColor(
  targets: RailwayDeploymentTarget[],
  configured: boolean
): "danger" | "default" | "success" | "warning" {
  if (!configured) return "default";
  if (targets.some((target) => isProblemStatus(target.status))) return "danger";
  if (targets.some((target) => isActiveStatus(target.status))) return "warning";
  return "success";
}

export function DeploymentStatusChip({ compact = false }: Readonly<DeploymentStatusChipProps>) {
  const { can } = useCan();
  const canReadDeployments = can("read", "Integration");
  const deploymentsQuery = useQuery({
    ...systemQueries.deployments(),
    enabled: canReadDeployments,
  });

  if (!canReadDeployments) {
    return null;
  }

  if (deploymentsQuery.isPending) {
    return <Skeleton className="h-8 w-28 rounded-full" />;
  }

  const data = deploymentsQuery.data;
  const targets = data?.targets ?? [];
  const configured = data?.configured ?? false;
  const label = summaryLabel(targets, configured);
  const color = summaryColor(targets, configured);

  const content = (
    <Chip color={color} size={compact ? "sm" : "md"} variant="soft">
      {label}
    </Chip>
  );

  if (deploymentsQuery.isError) {
    return (
      <Tooltip>
        <Tooltip.Trigger>{content}</Tooltip.Trigger>
        <Tooltip.Content>No se pudo consultar Railway.</Tooltip.Content>
      </Tooltip>
    );
  }

  const checkedAt = data?.checkedAt ? dayjs(data.checkedAt).format("DD-MM-YYYY HH:mm") : null;

  return (
    <Tooltip>
      <Tooltip.Trigger>{content}</Tooltip.Trigger>
      <Tooltip.Content>
        <div className="space-y-1 text-sm">
          {targets.length > 0 ? (
            targets.map((target) => (
              <div className="flex items-center justify-between gap-3" key={target.serviceId}>
                <span className="font-medium">{target.label}</span>
                <span>{statusLabel(target.status)}</span>
              </div>
            ))
          ) : (
            <div>Configura los IDs/token de Railway en el API.</div>
          )}
          {checkedAt ? (
            <div className="text-default-500 text-xs">Actualizado {checkedAt}</div>
          ) : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}
