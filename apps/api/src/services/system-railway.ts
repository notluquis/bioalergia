import { logError } from "../lib/logger";
import { z } from "zod";

const RAILWAY_GRAPHQL_ENDPOINT =
  process.env.RAILWAY_API_GRAPHQL_ENDPOINT ?? "https://backboard.railway.app/graphql/v2";
const CACHE_TTL_MS = 15_000;

const deploymentNodeSchema = z.object({
  createdAt: z.string().nullable().optional(),
  id: z.string(),
  status: z.string(),
});

const deploymentsResponseSchema = z.object({
  data: z
    .object({
      deployments: z.object({
        edges: z.array(
          z.object({
            node: deploymentNodeSchema,
          }),
        ),
      }),
    })
    .nullable(),
  errors: z
    .array(
      z.object({
        message: z.string(),
      }),
    )
    .optional(),
});

type RailwayDeploymentStatus =
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

interface RailwayDeploymentTargetConfig {
  environmentId: string;
  label: string;
  serviceId: string;
}

interface RailwayDeploymentTarget {
  createdAt: Date | null;
  deploymentId: null | string;
  environmentId: string;
  label: string;
  serviceId: string;
  status: RailwayDeploymentStatus;
}

interface RailwayDeploymentsSnapshot {
  checkedAt: Date;
  configured: boolean;
  errorMessage: null | string;
  targets: RailwayDeploymentTarget[];
}

let cachedSnapshot: null | RailwayDeploymentsSnapshot = null;
let cacheExpiresAt = 0;

function getAuthHeaders(): null | Record<string, string> {
  if (process.env.RAILWAY_PROJECT_TOKEN) {
    return {
      "Content-Type": "application/json",
      "Project-Access-Token": process.env.RAILWAY_PROJECT_TOKEN,
    };
  }

  if (process.env.RAILWAY_API_TOKEN) {
    return {
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  return null;
}

function summarizeGraphQLErrors(errors: Array<{ message: string }> | undefined): null | string {
  if (!errors || errors.length === 0) return null;
  return errors
    .map((entry) => entry.message.trim())
    .filter(Boolean)
    .join(" | ");
}

function normalizeStatus(status: null | string | undefined): RailwayDeploymentStatus {
  switch (status) {
    case "BUILDING":
    case "CRASHED":
    case "DEPLOYING":
    case "FAILED":
    case "QUEUED":
    case "REMOVED":
    case "SKIPPED":
    case "SLEEPING":
    case "SUCCESS":
    case "WAITING":
      return status;
    default:
      return "UNKNOWN";
  }
}

function getDeploymentTargets(): RailwayDeploymentTargetConfig[] {
  const defaultEnvironmentId = process.env.RAILWAY_DEPLOY_ENVIRONMENT_ID?.trim() || "";
  const currentEnvironmentId = process.env.RAILWAY_ENVIRONMENT_ID?.trim() || "";
  const apiServiceId =
    process.env.RAILWAY_DEPLOY_API_SERVICE_ID?.trim() || process.env.RAILWAY_SERVICE_ID?.trim() || "";
  const intranetServiceId = process.env.RAILWAY_DEPLOY_INTRANET_SERVICE_ID?.trim() || "";
  const apiEnvironmentId =
    process.env.RAILWAY_DEPLOY_API_ENVIRONMENT_ID?.trim() || defaultEnvironmentId || currentEnvironmentId;
  const intranetEnvironmentId =
    process.env.RAILWAY_DEPLOY_INTRANET_ENVIRONMENT_ID?.trim() ||
    defaultEnvironmentId ||
    currentEnvironmentId;

  return [
    {
      environmentId: apiEnvironmentId,
      label: process.env.RAILWAY_DEPLOY_API_LABEL?.trim() || "API",
      serviceId: apiServiceId,
    },
    {
      environmentId: intranetEnvironmentId,
      label: process.env.RAILWAY_DEPLOY_INTRANET_LABEL?.trim() || "Intranet",
      serviceId: intranetServiceId,
    },
  ].filter((target) => target.environmentId.length > 0 && target.serviceId.length > 0);
}

async function fetchLatestDeploymentForTarget(target: RailwayDeploymentTargetConfig) {
  const headers = getAuthHeaders();
  if (!headers) {
    throw new Error("Railway token no configurado");
  }

  const response = await fetch(RAILWAY_GRAPHQL_ENDPOINT, {
    body: JSON.stringify({
      operationName: "DeployStatusListDeployments",
      query: `
        query DeployStatusListDeployments($first: Int!, $input: DeploymentListInput!) {
          deployments(first: $first, input: $input) {
            edges {
              node {
                id
                status
                createdAt
              }
            }
          }
        }
      `,
      variables: {
        first: 1,
        input: {
          environmentId: target.environmentId,
          serviceId: target.serviceId,
        },
      },
    }),
    headers,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Railway API respondió ${response.status}`);
  }

  const payload = deploymentsResponseSchema.parse(await response.json());
  const graphQLErrorMessage = summarizeGraphQLErrors(payload.errors);

  if (!payload.data) {
    throw new Error(graphQLErrorMessage ?? "Railway no devolvió datos para deployments");
  }

  const latest = payload.data.deployments.edges[0]?.node ?? null;

  return {
    createdAt: latest?.createdAt ? new Date(latest.createdAt) : null,
    deploymentId: latest?.id ?? null,
    environmentId: target.environmentId,
    label: target.label,
    serviceId: target.serviceId,
    status: normalizeStatus(latest?.status),
  } satisfies RailwayDeploymentTarget;
}

export async function getRailwayDeploymentsSnapshot(): Promise<RailwayDeploymentsSnapshot> {
  const headers = getAuthHeaders();
  const targets = getDeploymentTargets();
  const now = Date.now();

  if (!headers || targets.length === 0) {
    return {
      checkedAt: new Date(),
      configured: false,
      errorMessage: headers ? "Faltan IDs de Railway en el API" : "Falta token de Railway en el API",
      targets: [],
    };
  }

  if (cachedSnapshot && cacheExpiresAt > now) {
    return cachedSnapshot;
  }

  try {
    const results = await Promise.all(
      targets.map((target) => fetchLatestDeploymentForTarget(target)),
    );

    const snapshot = {
      checkedAt: new Date(),
      configured: true,
      errorMessage: null,
      targets: results,
    } satisfies RailwayDeploymentsSnapshot;

    cachedSnapshot = snapshot;
    cacheExpiresAt = now + CACHE_TTL_MS;

    return snapshot;
  } catch (error) {
    logError("system.railway.deployments", error, {
      endpoint: RAILWAY_GRAPHQL_ENDPOINT,
      configuredTargets: targets.map((target) => ({
        environmentId: target.environmentId,
        label: target.label,
        serviceId: target.serviceId,
      })),
    });

    return {
      checkedAt: new Date(),
      configured: true,
      errorMessage: error instanceof Error ? error.message : "No se pudo consultar Railway",
      targets: [],
    };
  }
}
