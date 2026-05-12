export interface HealthResponse {
  checks: {
    db: {
      latency: null | number;
      message?: string;
      status: "error" | "ok";
    };
  };
  status: "degraded" | "error" | "ok";
  timestamp: Date;
}

export type RailwayDeploymentStatus =
  | "BUILDING"
  | "CRASHED"
  | "DEPLOYING"
  | "FAILED"
  | "QUEUED"
  | "REMOVED"
  | "SKIPPED"
  | "SLEEPING"
  | "SUCCESS"
  | "UNKNOWN"
  | "WAITING";

export interface RailwayDeploymentTarget {
  createdAt: Date | null;
  deploymentId: null | string;
  environmentId: string;
  label: string;
  serviceId: string;
  status: RailwayDeploymentStatus;
}

export interface RailwayDeploymentsResponse {
  checkedAt: Date;
  configured: boolean;
  errorMessage: null | string;
  targets: RailwayDeploymentTarget[];
}
