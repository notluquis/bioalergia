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

function formatRelativeAge(date: Date | null) {
  if (!date) return "sin hora";

  const minutes = Math.max(0, dayjs().diff(dayjs(date), "minute"));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.max(0, dayjs().diff(dayjs(date), "hour"));
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.max(0, dayjs().diff(dayjs(date), "day"));
  return `hace ${days} d`;
}

function shortDeploymentId(deploymentId: null | string) {
  if (!deploymentId) return null;
  return deploymentId.slice(0, 8);
}

function summaryLabel(
  targets: RailwayDeploymentTarget[],
  configured: boolean,
  errorMessage: null | string
) {
  if (!configured) return "Deploy n/d";
  if (errorMessage) return "Deploy error";
  if (targets.some((target) => isProblemStatus(target.status))) return "Deploy con falla";
  const activeTargets = targets.filter((target) => isActiveStatus(target.status));
  const activeCount = activeTargets.length;
  if (activeCount === 1) {
    const target = activeTargets[0];
    return `${target?.label ?? "Deploy"} · ${formatRelativeAge(target?.createdAt ?? null)}`;
  }
  if (activeCount > 0) return `${activeCount} deploys en curso`;
  return "Deploy estable";
}

function summaryColor(
  targets: RailwayDeploymentTarget[],
  configured: boolean,
  errorMessage: null | string
): "danger" | "default" | "success" | "warning" {
  if (!configured) return "default";
  if (errorMessage) return "danger";
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
  const errorMessage = data?.errorMessage ?? null;
  const label = summaryLabel(targets, configured, errorMessage);
  const color = summaryColor(targets, configured, errorMessage);

  const content = (
    <Chip color={color} size={compact ? "sm" : "md"} variant="soft">
      {label}
    </Chip>
  );

  if (deploymentsQuery.isError) {
    return (
      <Tooltip>
        <Tooltip.Trigger>{content}</Tooltip.Trigger>
        <Tooltip.Content>No se pudo consultar Railway desde el API.</Tooltip.Content>
      </Tooltip>
    );
  }

  const checkedAt = data?.checkedAt ? dayjs(data.checkedAt).tz().format("DD-MM-YYYY HH:mm") : null;
  const activeTargets = targets.filter((target) => isActiveStatus(target.status));
  const problemTargets = targets.filter((target) => isProblemStatus(target.status));
  const stableTargets = targets.filter(
    (target) => !isActiveStatus(target.status) && !isProblemStatus(target.status)
  );

  return (
    <Tooltip>
      <Tooltip.Trigger>{content}</Tooltip.Trigger>
      <Tooltip.Content className="max-w-sm">
        <div className="space-y-3 text-sm">
          {activeTargets.length > 0 ? (
            <div className="space-y-1.5">
              <div className="font-medium">En curso</div>
              {activeTargets.map((target) => (
                <div className="flex items-start justify-between gap-3" key={target.serviceId}>
                  <div className="min-w-0">
                    <div className="font-medium">{target.label}</div>
                    <div className="text-default-500 text-xs">
                      {statusLabel(target.status)} · {formatRelativeAge(target.createdAt)}
                    </div>
                  </div>
                  <div className="text-default-500 shrink-0 text-xs tabular-nums">
                    {shortDeploymentId(target.deploymentId) ?? "sin id"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {problemTargets.length > 0 ? (
            <div className="space-y-1.5">
              <div className="font-medium">Con falla</div>
              {problemTargets.map((target) => (
                <div className="flex items-start justify-between gap-3" key={target.serviceId}>
                  <div className="min-w-0">
                    <div className="font-medium">{target.label}</div>
                    <div className="text-default-500 text-xs">
                      {statusLabel(target.status)} · {formatRelativeAge(target.createdAt)}
                    </div>
                  </div>
                  <div className="text-default-500 shrink-0 text-xs tabular-nums">
                    {shortDeploymentId(target.deploymentId) ?? "sin id"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {stableTargets.length > 0 ? (
            <div className="space-y-1.5">
              <div className="font-medium">Último estado</div>
              {stableTargets.map((target) => (
                <div className="flex items-start justify-between gap-3" key={target.serviceId}>
                  <div className="min-w-0">
                    <div className="font-medium">{target.label}</div>
                    <div className="text-default-500 text-xs">
                      {statusLabel(target.status)} · {formatRelativeAge(target.createdAt)}
                    </div>
                  </div>
                  <div className="text-default-500 shrink-0 text-xs tabular-nums">
                    {shortDeploymentId(target.deploymentId) ?? "sin id"}
                  </div>
                </div>
              ))}
            </div>
          ) : errorMessage ? (
            <div className="max-w-sm space-y-1">
              <div className="font-medium">Railway respondió con error</div>
              <div>{errorMessage}</div>
            </div>
          ) : !configured ? (
            <div className="max-w-sm space-y-1">
              <div className="font-medium">Configuración incompleta</div>
              <div>Define token e IDs de Railway en el servicio `api`.</div>
            </div>
          ) : (
            <div className="max-w-sm">No se encontraron servicios configurados para mostrar.</div>
          )}
          {checkedAt ? (
            <div className="text-default-500 text-xs">Actualizado {checkedAt}</div>
          ) : null}
        </div>
      </Tooltip.Content>
    </Tooltip>
  );
}
