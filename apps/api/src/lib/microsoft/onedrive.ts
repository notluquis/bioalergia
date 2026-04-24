import { deleteSetting, getSetting, updateSetting } from "../../services/settings";

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_SCOPES = ["offline_access", "Files.Read"];

const SETTINGS = {
  accessToken: "microsoft:onedrive:accessToken",
  deltaLink: "microsoft:onedrive:skinTests:deltaLink",
  expiresAt: "microsoft:onedrive:expiresAt",
  folderPath: "microsoft:onedrive:skinTests:folderPath",
  lastDeltaSyncAt: "microsoft:onedrive:skinTests:lastDeltaSyncAt",
  lastSyncAt: "microsoft:onedrive:skinTests:lastSyncAt",
  refreshToken: "microsoft:onedrive:refreshToken",
};

export interface OneDriveStatus {
  connected: boolean;
  folderPath: null | string;
  lastDeltaSyncAt: null | string;
  lastSyncAt: null | string;
}

export interface OneDriveItem {
  cTag?: string;
  deleted?: unknown;
  eTag?: string;
  file?: { mimeType?: string };
  id: string;
  lastModifiedDateTime?: string;
  name: string;
  parentReference?: {
    driveId?: string;
    path?: string;
  };
  size?: number;
  webUrl?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
}

interface DeltaResponse {
  "@odata.deltaLink"?: string;
  "@odata.nextLink"?: string;
  value?: OneDriveItem[];
}

function getClientConfig() {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth no configurado. Define MICROSOFT_OAUTH_CLIENT_ID y MICROSOFT_OAUTH_CLIENT_SECRET.");
  }
  return { clientId, clientSecret };
}

export function getOneDriveAuthUrl(redirectUri: string): string {
  const { clientId } = getClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    prompt: "consent",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DEFAULT_SCOPES.join(" "),
  });
  return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
}

export async function connectOneDriveWithCode(code: string, redirectUri: string): Promise<void> {
  const { clientId, clientSecret } = getClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES.join(" "),
  });
  const tokens = await requestToken(body);
  await persistTokens(tokens);
}

export async function disconnectOneDrive(): Promise<void> {
  await Promise.all([
    deleteSetting(SETTINGS.accessToken).catch(() => null),
    deleteSetting(SETTINGS.expiresAt).catch(() => null),
    deleteSetting(SETTINGS.refreshToken).catch(() => null),
    deleteSetting(SETTINGS.deltaLink).catch(() => null),
  ]);
}

export async function getOneDriveStatus(): Promise<OneDriveStatus> {
  const [refreshToken, folderPath, lastDeltaSyncAt, lastSyncAt] = await Promise.all([
    getSetting(SETTINGS.refreshToken),
    getSetting(SETTINGS.folderPath),
    getSetting(SETTINGS.lastDeltaSyncAt),
    getSetting(SETTINGS.lastSyncAt),
  ]);
  return {
    connected: Boolean(refreshToken),
    folderPath,
    lastDeltaSyncAt,
    lastSyncAt,
  };
}

export async function setOneDriveFolderPath(folderPath: string): Promise<void> {
  await updateSetting(SETTINGS.folderPath, folderPath.replace(/^\/+|\/+$/g, ""));
  await deleteSetting(SETTINGS.deltaLink).catch(() => null);
}

export async function listOneDriveDeltaItems(options?: {
  force?: boolean;
  folderPath?: string;
}): Promise<{ items: OneDriveItem[]; totalPages: number }> {
  const accessToken = await getOneDriveAccessToken();
  const configuredFolder = options?.folderPath ?? (await getSetting(SETTINGS.folderPath)) ?? "";
  const existingDelta = options?.force ? null : await getSetting(SETTINGS.deltaLink);
  let url = existingDelta || buildDeltaUrl(configuredFolder);
  const items: OneDriveItem[] = [];
  let totalPages = 0;

  while (url) {
    totalPages += 1;
    const response = await graphFetch<DeltaResponse>(url, accessToken);
    items.push(...(response.value ?? []));
    url = response["@odata.nextLink"] ?? "";
    if (response["@odata.deltaLink"]) {
      await updateSetting(SETTINGS.deltaLink, response["@odata.deltaLink"]);
      await updateSetting(SETTINGS.lastDeltaSyncAt, new Date().toISOString());
    }
  }

  await updateSetting(SETTINGS.lastSyncAt, new Date().toISOString());
  return { items, totalPages };
}

export async function downloadOneDriveItem(itemId: string): Promise<Buffer> {
  const accessToken = await getOneDriveAccessToken();
  const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${encodeURIComponent(itemId)}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`OneDrive download failed ${response.status}: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function getOneDriveAccessToken(): Promise<string> {
  const expiresAt = Number(await getSetting(SETTINGS.expiresAt));
  const cachedAccessToken = await getSetting(SETTINGS.accessToken);
  if (cachedAccessToken && Number.isFinite(expiresAt) && Date.now() < expiresAt - 60_000) {
    return cachedAccessToken;
  }

  const refreshToken = await getSetting(SETTINGS.refreshToken);
  if (!refreshToken) {
    throw new Error("OneDrive no conectado.");
  }

  const { clientId, clientSecret } = getClientConfig();
  const tokens = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: DEFAULT_SCOPES.join(" "),
    }),
  );
  await persistTokens(tokens);
  return tokens.access_token;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(MICROSOFT_TOKEN_URL, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const payload = await response.json() as Partial<TokenResponse> & { error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? `Microsoft OAuth failed ${response.status}`);
  }
  return payload as TokenResponse;
}

async function persistTokens(tokens: TokenResponse): Promise<void> {
  await updateSetting(SETTINGS.accessToken, tokens.access_token);
  await updateSetting(
    SETTINGS.expiresAt,
    String(Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000),
  );
  if (tokens.refresh_token) {
    await updateSetting(SETTINGS.refreshToken, tokens.refresh_token);
  }
}

function buildDeltaUrl(folderPath: string): string {
  const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
  if (!cleanPath) {
    return `${GRAPH_BASE_URL}/me/drive/root/delta`;
  }
  return `${GRAPH_BASE_URL}/me/drive/root:/${encodeURIComponent(cleanPath).replace(/%2F/g, "/")}:/delta`;
}

async function graphFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Microsoft Graph failed ${response.status}: ${await response.text()}`);
  }
  return await response.json() as T;
}
