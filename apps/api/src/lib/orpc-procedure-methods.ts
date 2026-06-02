import * as contracts from "@finanzas/orpc-contracts";

/**
 * RPC-tunnel read/write classification.
 *
 * oRPC's RPC tunnel POSTs *every* operation — reads and writes alike — to
 * `/api/orpc/<ns>/rpc/<procedure>`, so the HTTP method on the wire is
 * useless for telling a read from a write. The contract, however, still
 * declares the semantic verb via `.route({ method })` (`GET` for reads,
 * `POST`/`PUT`/`PATCH`/`DELETE` for writes).
 *
 * This module builds a `"<ns>/<procedure>" → method` map from every
 * exported `*Contract` at boot, so server-side guards (notably the
 * E2E read-only guard in app.ts) can allow POST-tunnelled *reads* while
 * still blocking real mutations. Without this, a read-only role can't
 * load any data-backed page — every oRPC read is a POST and a blanket
 * POST block rejects it.
 *
 * The map is derived automatically (no hand-maintained list to drift):
 * each `<camelName>Contract` export maps to the kebab-case namespace its
 * server router is mounted under (`clinicalSeriesContract` →
 * `clinical-series`, matching `.prefix("/api/orpc/clinical-series")`).
 */

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function camelToKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

type ContractProcedure = { "~orpc"?: { route?: { method?: string } } };

/** `"<ns>/<procedure>"` → declared contract HTTP method (uppercase). */
const PROCEDURE_METHODS = new Map<string, string>();

for (const [exportName, value] of Object.entries(contracts)) {
  if (!exportName.endsWith("Contract")) continue;
  if (!value || typeof value !== "object") continue;
  const ns = camelToKebab(exportName.replace(/Contract$/, ""));
  for (const [procName, proc] of Object.entries(value as Record<string, unknown>)) {
    const method = (proc as ContractProcedure)?.["~orpc"]?.route?.method;
    if (method) PROCEDURE_METHODS.set(`${ns}/${procName}`, method.toUpperCase());
  }
}

const RPC_TUNNEL_PATH = /^\/api\/orpc\/([^/]+)\/rpc\/([^/?#]+)/;

/**
 * True when `pathname` is an RPC-tunnel call to a procedure the contract
 * declares as a read (`GET`/`HEAD`/`OPTIONS`).
 *
 * Returns false for anything that can't be positively confirmed as a
 * read — non-RPC-tunnel paths (OpenAPI handler routes carry a real HTTP
 * method already) and procedures absent from the map. Callers treat
 * `false` as "not provably a read", so an unknown procedure fails closed
 * (blocked for a read-only role) rather than open.
 */
export function isRpcTunnelRead(pathname: string): boolean {
  const match = RPC_TUNNEL_PATH.exec(pathname);
  if (!match) return false;
  const method = PROCEDURE_METHODS.get(`${match[1]}/${match[2]}`);
  return method !== undefined && READ_METHODS.has(method);
}
