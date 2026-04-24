import { db } from "@finanzas/db";

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_SCOPES = ["offline_access", "Files.Read", "User.Read"];
const ONEDRIVE_WEBHOOK_CLIENT_STATE = "bioalergia-onedrive-sync";

export interface OneDriveAccountStatus {
  accountId: string;
  email: string;
  name: string | null;
  folderPath: string | null;
  lastDeltaSyncAt: string | null;
  lastSyncAt: string | null;
}

export interface OneDriveStatus {
  connected: boolean;
  accounts: OneDriveAccountStatus[];
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

interface GraphMeResponse {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail?: string;
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
    prompt: "select_account",
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
  
  // Get user info to store account
  const me = await graphFetch<GraphMeResponse>(`${GRAPH_BASE_URL}/me`, tokens.access_token);
  const accountId = me.id;
  const email = me.mail || me.userPrincipalName;
  const name = me.displayName;

  const expiresAt = String(Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000);

  await db.oneDriveAccount.upsert({
    where: { accountId },
    create: {
      id: accountId,
      accountId,
      email,
      name,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt,
    },
    update: {
      email,
      name,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
    }
  });

  await setupOneDriveSubscription(accountId, null);
}

export async function disconnectOneDrive(accountId: string): Promise<void> {
  const existing = await db.oneDriveWatchChannel.findFirst({
    where: { accountId },
    select: { subscriptionId: true }
  });

  if (existing) {
    try {
      const accessToken = await getOneDriveAccessToken(accountId);
      await graphRequest(`${GRAPH_BASE_URL}/subscriptions/${existing.subscriptionId}`, accessToken, { method: "DELETE" });
    } catch {
      // Ignore
    }
  }

  await db.oneDriveAccount.delete({
    where: { accountId }
  }).catch(() => null);
}

export async function getOneDriveStatus(): Promise<OneDriveStatus> {
  const accounts = await db.oneDriveAccount.findMany({
    select: { accountId: true, email: true, name: true, folderPath: true, lastDeltaSyncAt: true, lastSyncAt: true }
  });

  return {
    connected: accounts.length > 0,
    accounts: accounts.map((acc) => ({
      accountId: acc.accountId,
      email: acc.email,
      name: acc.name,
      folderPath: acc.folderPath,
      lastDeltaSyncAt: acc.lastDeltaSyncAt ? acc.lastDeltaSyncAt.toISOString() : null,
      lastSyncAt: acc.lastSyncAt ? acc.lastSyncAt.toISOString() : null,
    })),
  };
}

export async function setOneDriveFolderPath(accountId: string, folderPath: string): Promise<void> {
  const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
  await db.oneDriveAccount.update({
    where: { accountId },
    data: {
      folderPath: cleanPath,
      deltaLink: null,
    }
  });

  await setupOneDriveSubscription(accountId, cleanPath);
}

export async function listOneDriveDeltaItems(accountId: string, options?: {
  force?: boolean;
}): Promise<{ items: OneDriveItem[]; totalPages: number }> {
  const account = await db.oneDriveAccount.findFirst({
    where: { accountId },
    select: { folderPath: true, deltaLink: true }
  });
    
  if (!account) throw new Error("Account not found");

  const accessToken = await getOneDriveAccessToken(accountId);
  const configuredFolder = account.folderPath ?? "";
  const existingDelta = options?.force ? null : account.deltaLink;
  
  let url = existingDelta || buildDeltaUrl(configuredFolder);
  const items: OneDriveItem[] = [];
  let totalPages = 0;

  while (url) {
    totalPages += 1;
    const response = await graphFetch<DeltaResponse>(url, accessToken);
    items.push(...(response.value ?? []));
    url = response["@odata.nextLink"] ?? "";
    if (response["@odata.deltaLink"]) {
      await db.oneDriveAccount.update({
        where: { accountId },
        data: {
          deltaLink: response["@odata.deltaLink"],
          lastDeltaSyncAt: new Date(),
        }
      });
    }
  }

  await db.oneDriveAccount.update({
    where: { accountId },
    data: {
      lastSyncAt: new Date(),
    }
  });
    
  return { items, totalPages };
}

export async function downloadOneDriveItem(accountId: string, itemId: string): Promise<Buffer> {
  const accessToken = await getOneDriveAccessToken(accountId);
  const response = await fetch(`${GRAPH_BASE_URL}/me/drive/items/${encodeURIComponent(itemId)}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`OneDrive download failed ${response.status}: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function getOneDriveAccessToken(accountId: string): Promise<string> {
  const account = await db.oneDriveAccount.findFirst({
    where: { accountId },
    select: { accessToken: true, refreshToken: true, expiresAt: true }
  });
    
  if (!account) throw new Error("OneDrive no conectado.");

  const expiresAt = Number(account.expiresAt);
  if (account.accessToken && Number.isFinite(expiresAt) && Date.now() < expiresAt - 60_000) {
    return account.accessToken;
  }

  if (!account.refreshToken) {
    throw new Error("No refresh token available.");
  }

  const { clientId, clientSecret } = getClientConfig();
  const tokens = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
      scope: DEFAULT_SCOPES.join(" "),
    }),
  );
  
  const newExpiresAt = String(Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000);
  
  await db.oneDriveAccount.update({
    where: { accountId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? account.refreshToken,
      expiresAt: newExpiresAt,
    }
  });
    
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

function buildDeltaUrl(folderPath: string): string {
  const cleanPath = folderPath.replace(/^\/+|\/+$/g, "");
  if (!cleanPath) {
    return `${GRAPH_BASE_URL}/me/drive/root/delta`;
  }
  return `${GRAPH_BASE_URL}/me/drive/root:/${encodeURIComponent(cleanPath).replace(/%2F/g, "/")}:/delta`;
}

async function graphFetch<T>(url: string, accessToken: string): Promise<T> {
  return await graphRequest<T>(url, accessToken);
}

async function graphRequest<T>(url: string, accessToken: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers 
    },
  });
  if (!response.ok) {
    throw new Error(`Microsoft Graph failed ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return {} as T;
  return await response.json() as T;
}

export async function setupOneDriveSubscription(accountId: string, folderPath: string | null) {
  const accessToken = await getOneDriveAccessToken(accountId);
  const cleanPath = folderPath?.replace(/^\/+|\/+$/g, "");
  const resource = cleanPath ? `me/drive/root:/${encodeURIComponent(cleanPath)}` : "me/drive/root";
  
  const expirationDateTime = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  const webhookUrl = `${process.env.PUBLIC_URL || "https://intranet.bioalergia.cl"}/api/webhooks/onedrive`;

  const existing = await db.oneDriveWatchChannel.findFirst({
    where: { accountId },
    select: { id: true, subscriptionId: true }
  });

  if (existing) {
    try {
      await graphRequest(`${GRAPH_BASE_URL}/subscriptions/${existing.subscriptionId}`, accessToken, { method: "DELETE" });
    } catch {
      // Ignore
    }
    await db.oneDriveWatchChannel.delete({ where: { id: existing.id } });
  }

  const payload = {
    changeType: "updated",
    notificationUrl: webhookUrl,
    resource: resource,
    expirationDateTime,
    clientState: ONEDRIVE_WEBHOOK_CLIENT_STATE
  };

  const sub = await graphRequest<{ id: string }>(`${GRAPH_BASE_URL}/subscriptions`, accessToken, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  await db.oneDriveWatchChannel.create({
    data: {
      id: sub.id,
      accountId,
      subscriptionId: sub.id,
      resource,
      expiration: new Date(expirationDateTime),
      webhookUrl,
    }
  });
}

export async function renewOneDriveSubscription(accountId: string) {
  const channel = await db.oneDriveWatchChannel.findFirst({
    where: { accountId },
    select: { id: true, subscriptionId: true, expiration: true }
  });

  if (!channel) return;

  const expirationDate = new Date(channel.expiration);
  const daysUntilExpiration = (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiration < 3) {
    const accessToken = await getOneDriveAccessToken(accountId);
    const newExpiration = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await graphRequest(`${GRAPH_BASE_URL}/subscriptions/${channel.subscriptionId}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ expirationDateTime: newExpiration })
      });

      await db.oneDriveWatchChannel.update({
        where: { id: channel.id },
        data: { expiration: new Date(newExpiration) }
      });
    } catch (error) {
      console.error(`Failed to renew OneDrive subscription for ${accountId}:`, error);
      const account = await db.oneDriveAccount.findFirst({
        where: { accountId },
        select: { folderPath: true }
      });
      if (account) {
        await setupOneDriveSubscription(accountId, account.folderPath);
      }
    }
  }
}

export async function renewAllOneDriveSubscriptions() {
  const accounts = await db.oneDriveAccount.findMany({ select: { accountId: true } });
  for (const acc of accounts) {
    await renewOneDriveSubscription(acc.accountId);
  }
}
