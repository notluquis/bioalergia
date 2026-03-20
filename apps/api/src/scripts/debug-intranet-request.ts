import { readFile } from "node:fs/promises";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";
import { NodeCryptoPlugin } from "@otplib/plugin-crypto-node";
import { OTP } from "otplib";

type HttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
type DebugScope = {
  action: string;
  subject: string;
};

type ParsedArgs = {
  baseUrl: string;
  expiresInMinutes: number;
  help: boolean;
  mode: "generic" | "mercadopago-download";
  reason: string;
  requestMethod: HttpMethod;
  requestPath: string;
  requestQueryJson?: string;
  requestJson?: string;
  reportType: "release" | "settlement";
  scopeArgs: string[];
  targetUserId: number;
};

function printHelp() {
  console.log(`Usage:
  pnpm --filter @finanzas/api debug:intranet-request -- --target-user-id 5 --scope read:Integration --request-path /api/orpc/system/rpc/deployments --request-query-json '{}'

  pnpm --filter @finanzas/api debug:mp-download -- --target-user-id 5 --file-name 2026-03-20.csv --report-type release

Required env:
  One of:
    DEBUG_LOGIN_EMAIL + DEBUG_LOGIN_PASSWORD
    DEBUG_SESSION_COOKIE
    DEBUG_SESSION_COOKIE_FILE

Optional env:
  DEBUG_BASE_URL            Defaults to https://intranet.bioalergia.cl
  DEBUG_LOGIN_TOTP_TOKEN    MFA code for loginMfa when MFA is enabled
  DEBUG_LOGIN_TOTP_SECRET   MFA secret used to generate the code automatically
  DEBUG_LOGIN_TOTP_SECRET_FILE
                            Path to a local file containing the MFA secret

Options:
  --target-user-id <id>     User to impersonate with the debug token
  --scope <action:subject>  Repeatable; default is read:Integration
  --reason <text>           Audit reason stored in the token
  --expires-in <minutes>    Defaults to 10, max 15
  --request-path <path>     Path on intranet.bioalergia.cl for generic mode
  --request-method <verb>   GET, POST, PUT, PATCH, DELETE
  --request-query-json <json>
                            JSON payload encoded into the oRPC 'data' query param for GET requests
  --request-json <json>     JSON payload wrapped as { json: ... } for non-GET requests
  --file-name <name>        MercadoPago filename for mercadopago-download mode
  --report-type <type>      release | settlement
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const baseUrl = process.env.DEBUG_BASE_URL?.trim() || "https://intranet.bioalergia.cl";
  const args: ParsedArgs = {
    baseUrl: baseUrl.replace(/\/$/, ""),
    expiresInMinutes: 10,
    help: false,
    mode: "generic",
    reason: "Codex debug request",
    reportType: "release",
    requestMethod: "GET",
    requestPath: "",
    scopeArgs: [],
    targetUserId: 0,
  };

  let fileName = "";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--mode":
        if (next === "generic" || next === "mercadopago-download") {
          args.mode = next;
          index += 1;
        }
        break;
      case "--target-user-id":
        args.targetUserId = Number(next);
        index += 1;
        break;
      case "--scope":
        if (next) {
          args.scopeArgs.push(next);
          index += 1;
        }
        break;
      case "--reason":
        args.reason = next || args.reason;
        index += 1;
        break;
      case "--expires-in":
        args.expiresInMinutes = Number(next);
        index += 1;
        break;
      case "--request-path":
        args.requestPath = next || "";
        index += 1;
        break;
      case "--request-method": {
        const upper = (next || "").toUpperCase();
        if (upper === "DELETE" || upper === "GET" || upper === "PATCH" || upper === "POST" || upper === "PUT") {
          args.requestMethod = upper;
        }
        index += 1;
        break;
      }
      case "--request-query-json":
        args.requestQueryJson = next;
        index += 1;
        break;
      case "--request-json":
        args.requestJson = next;
        index += 1;
        break;
      case "--file-name":
        fileName = next || "";
        index += 1;
        break;
      case "--report-type":
        if (next === "release" || next === "settlement") {
          args.reportType = next;
          args.mode = "mercadopago-download";
        }
        index += 1;
        break;
      default:
        break;
    }
  }

  if (fileName) {
    args.mode = "mercadopago-download";
    args.requestMethod = "GET";
    args.requestPath = "/api/orpc/mercadopago/rpc/downloadReport";
    args.requestQueryJson = JSON.stringify({
      fileName,
      type: args.reportType,
    });
    args.reason = `Debug MercadoPago ${args.reportType} download ${fileName}`;
    if (args.scopeArgs.length === 0) {
      args.scopeArgs.push("read:Integration");
    }
  }

  return args;
}

const otp = new OTP({
  base32: new ScureBase32Plugin(),
  crypto: new NodeCryptoPlugin(),
});

async function loadTextEnvOrFile(options: {
  envKey: string;
  fileEnvKey: string;
}): Promise<null | string> {
  const inline = process.env[options.envKey]?.trim();
  if (inline) {
    return inline;
  }

  const filePath = process.env[options.fileEnvKey]?.trim();
  if (!filePath) {
    return null;
  }

  const contents = await readFile(filePath, "utf8");
  const trimmed = contents.trim();
  return trimmed || null;
}

function extractSessionCookie(response: Response): string {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter((value): value is string => Boolean(value));

  for (const value of values) {
    const match = value.match(/(?:^|,\s*)finanzas_session=([^;]+)/);
    if (match?.[1]) {
      return `finanzas_session=${match[1]}`;
    }
  }

  throw new Error("No finanzas_session cookie returned by auth endpoint");
}

async function resolveMfaToken(): Promise<null | string> {
  const directToken = process.env.DEBUG_LOGIN_TOTP_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }

  const secret = await loadTextEnvOrFile({
    envKey: "DEBUG_LOGIN_TOTP_SECRET",
    fileEnvKey: "DEBUG_LOGIN_TOTP_SECRET_FILE",
  });
  if (!secret) {
    return null;
  }

  return await otp.generate({ secret });
}

async function loginWithCredentials(baseUrl: string): Promise<string> {
  const email = process.env.DEBUG_LOGIN_EMAIL?.trim();
  const password = process.env.DEBUG_LOGIN_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("DEBUG_LOGIN_EMAIL and DEBUG_LOGIN_PASSWORD are required for credential login");
  }

  const loginResponse = await fetch(`${baseUrl}/api/orpc/auth/rpc/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      json: {
        email,
        password,
      },
    }),
  });

  const loginBody = await expectJson(loginResponse);
  if (!loginResponse.ok) {
    throw new Error(`login failed (${loginResponse.status}): ${JSON.stringify(loginBody)}`);
  }

  const payload =
    loginBody && typeof loginBody === "object" && "json" in loginBody ? loginBody.json : loginBody;

  if (!payload || typeof payload !== "object" || !("status" in payload)) {
    throw new Error(`login returned unexpected payload: ${JSON.stringify(loginBody)}`);
  }

  if (payload.status === "ok") {
    return extractSessionCookie(loginResponse);
  }

  if (payload.status !== "mfa_required" || typeof payload.userId !== "number") {
    throw new Error(`login returned unexpected auth status: ${JSON.stringify(loginBody)}`);
  }

  const token = await resolveMfaToken();
  if (!token) {
    throw new Error(
      "MFA required. Set DEBUG_LOGIN_TOTP_TOKEN or DEBUG_LOGIN_TOTP_SECRET/DEBUG_LOGIN_TOTP_SECRET_FILE",
    );
  }

  const mfaResponse = await fetch(`${baseUrl}/api/orpc/auth/rpc/loginMfa`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      json: {
        token,
        userId: payload.userId,
      },
    }),
  });

  const mfaBody = await expectJson(mfaResponse);
  if (!mfaResponse.ok) {
    throw new Error(`loginMfa failed (${mfaResponse.status}): ${JSON.stringify(mfaBody)}`);
  }

  return extractSessionCookie(mfaResponse);
}

async function loadSessionCookieSource(baseUrl: string): Promise<string> {
  const inline = process.env.DEBUG_SESSION_COOKIE?.trim();
  if (inline) {
    return inline;
  }

  const filePath = process.env.DEBUG_SESSION_COOKIE_FILE?.trim();
  if (filePath) {
    const contents = await readFile(filePath, "utf8");
    return contents.trim();
  }

  if (process.env.DEBUG_LOGIN_EMAIL?.trim() || process.env.DEBUG_LOGIN_PASSWORD?.trim()) {
    return loginWithCredentials(baseUrl);
  }

  throw new Error(
    "Provide DEBUG_LOGIN_EMAIL + DEBUG_LOGIN_PASSWORD, DEBUG_SESSION_COOKIE, or DEBUG_SESSION_COOKIE_FILE",
  );
}

function normalizeSessionCookie(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error("Debug session cookie source is empty");
  }

  if (trimmed.startsWith("finanzas_session=")) {
    return trimmed.split(";")[0] || trimmed;
  }

  return `finanzas_session=${trimmed}`;
}

function parseScopes(values: string[]): DebugScope[] {
  const rawScopes = values.length > 0 ? values : ["read:Integration"];

  return rawScopes.map((value) => {
    const separator = value.indexOf(":");
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error(`Invalid scope '${value}'. Expected action:subject`);
    }

    return {
      action: value.slice(0, separator),
      subject: value.slice(separator + 1),
    };
  });
}

function parseJsonArg(label: string, rawValue: string | undefined): unknown {
  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch (error) {
    throw new Error(
      `${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function expectJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function issueDebugToken(params: {
  baseUrl: string;
  expiresInMinutes: number;
  reason: string;
  scopes: DebugScope[];
  sessionCookie: string;
  targetUserId: number;
}) {
  const response = await fetch(`${params.baseUrl}/api/orpc/auth/rpc/issueDebugToken`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: params.sessionCookie,
    },
    body: JSON.stringify({
      json: {
        audience: "debug-cli",
        expiresInMinutes: params.expiresInMinutes,
        reason: params.reason,
        scopes: params.scopes,
        targetUserId: params.targetUserId,
      },
    }),
  });

  const body = await expectJson(response);
  if (!response.ok) {
    throw new Error(`issueDebugToken failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const token =
    body && typeof body === "object" && "json" in body && body.json && typeof body.json === "object"
      ? ("token" in body.json ? body.json.token : undefined)
      : undefined;

  if (typeof token !== "string" || token.length === 0) {
    throw new Error(`issueDebugToken did not return a token: ${JSON.stringify(body)}`);
  }

  return token;
}

async function exchangeDebugToken(baseUrl: string, token: string) {
  const response = await fetch(`${baseUrl}/api/orpc/auth/rpc/exchangeDebugToken`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      json: {
        delivery: "bearer",
        token,
      },
    }),
  });

  const body = await expectJson(response);
  if (!response.ok) {
    throw new Error(`exchangeDebugToken failed (${response.status}): ${JSON.stringify(body)}`);
  }

  const accessToken =
    body && typeof body === "object" && "json" in body && body.json && typeof body.json === "object"
      ? ("accessToken" in body.json ? body.json.accessToken : undefined)
      : undefined;

  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error(`exchangeDebugToken did not return accessToken: ${JSON.stringify(body)}`);
  }

  return accessToken;
}

function buildRequestUrl(baseUrl: string, args: ParsedArgs): string {
  const url = new URL(args.requestPath, baseUrl);

  if (args.requestMethod === "GET") {
    const queryPayload = parseJsonArg("request-query-json", args.requestQueryJson);
    url.searchParams.set("data", JSON.stringify({ json: queryPayload }));
  }

  return url.toString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!Number.isInteger(args.targetUserId) || args.targetUserId <= 0) {
    throw new Error("--target-user-id is required");
  }

  if (!args.requestPath) {
    throw new Error("--request-path is required");
  }

  if (args.expiresInMinutes < 1 || args.expiresInMinutes > 15) {
    throw new Error("--expires-in must be between 1 and 15 minutes");
  }

  const sessionCookie = normalizeSessionCookie(await loadSessionCookieSource(args.baseUrl));
  const scopes = parseScopes(args.scopeArgs);
  const debugToken = await issueDebugToken({
    baseUrl: args.baseUrl,
    expiresInMinutes: args.expiresInMinutes,
    reason: args.reason,
    scopes,
    sessionCookie,
    targetUserId: args.targetUserId,
  });
  const accessToken = await exchangeDebugToken(args.baseUrl, debugToken);

  const requestUrl = buildRequestUrl(args.baseUrl, args);
  const headers = new Headers({
    authorization: `Bearer ${accessToken}`,
  });

  let body: string | undefined;
  if (args.requestMethod !== "GET") {
    headers.set("content-type", "application/json");
    body = JSON.stringify({
      json: parseJsonArg("request-json", args.requestJson),
    });
  }

  const response = await fetch(requestUrl, {
    body,
    headers,
    method: args.requestMethod,
  });

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const responseBody = contentType.includes("application/json")
    ? await expectJson(response)
    : await response.text();

  console.log(
    JSON.stringify(
      {
        ok: response.ok,
        request: {
          baseUrl: args.baseUrl,
          method: args.requestMethod,
          path: args.requestPath,
          scopes,
          targetUserId: args.targetUserId,
        },
        response: {
          body: responseBody,
          contentType,
          status: response.status,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
