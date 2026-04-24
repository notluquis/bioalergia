import { db } from "@finanzas/db";
import { logError, logEvent, logWarn } from "../logger";

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const DEFAULT_SCOPES = ["offline_access", "Files.Read", "User.Read"];
const ONEDRIVE_WEBHOOK_CLIENT_STATE = "bioalergia-onedrive-sync";

// Process-scoped token cache — safe because access tokens last ~3600s.
// Avoids a DB hit per file during sync (N xlsx = N redundant DB queries without this).
const _tokenCache = new Map<string, { expiresAt: number; token: string }>();

export interface OneDriveAccountStatus {
  accountId: string;
  email: string;
  folderDriveId: string | null;
  folderItemId: string | null;
  folderName: string | null;
  name: string | null;
  folderPath: string | null;
  lastDeltaSyncAt: string | null;
  lastSyncAt: string | null;
  subscription: {
    expiresAt: string | null;
    resource: string | null;
    status: "ACTIVE" | "EXPIRED" | "MISSING";
    subscriptionId: string | null;
  };
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
  folder?: unknown;
  id: string;
  lastModifiedDateTime?: string;
  name: string;
  parentReference?: {
    driveId?: string;
    path?: string;
  };
  remoteItem?: {
    folder?: unknown;
    id?: string;
    name?: string;
    parentReference?: {
      driveId?: string;
      path?: string;
    };
    webUrl?: string;
  };
  size?: number;
  webUrl?: string;
}

export interface OneDriveFolderSelection {
  driveId?: null | string;
  folderPath?: string;
  itemId?: null | string;
  name?: null | string;
}

export interface OneDriveFolderItem {
  driveId: null | string;
  hasChildren: boolean;
  id: string;
  isRemote: boolean;
  name: string;
  path: null | string;
  webUrl: null | string;
  xlsxCount: number;
}

export class OneDriveSubscriptionError extends Error {
  constructor(
    message: string,
    public readonly details: {
      body?: string;
      clientRequestId?: string | null;
      code?: string | null;
      requestId?: string | null;
      status?: number;
      webhookUrl?: string;
    } = {}
  ) {
    super(message);
    this.name = "OneDriveSubscriptionError";
  }
}

class MicrosoftGraphError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
    public readonly parsed?: {
      error?: {
        code?: string;
        innerError?: {
          "client-request-id"?: string;
          "request-id"?: string;
          date?: string;
        };
        message?: string;
      };
    }
  ) {
    super(message);
    this.name = "MicrosoftGraphError";
  }
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

interface ChildrenResponse {
  "@odata.nextLink"?: string;
  value?: OneDriveItem[];
}

function getClientConfig() {
  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Microsoft OAuth no configurado. Define MICROSOFT_OAUTH_CLIENT_ID y MICROSOFT_OAUTH_CLIENT_SECRET."
    );
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
      folderName: "Raíz",
      folderPath: "",
    },
    update: {
      email,
      name,
      accessToken: tokens.access_token,
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
    },
  });

  await setupOneDriveSubscription(accountId).catch(() => null);
}

export async function disconnectOneDrive(accountId: string): Promise<void> {
  const existing = await db.oneDriveWatchChannel.findFirst({
    where: { accountId },
    select: { subscriptionId: true },
  });

  if (existing) {
    try {
      const accessToken = await getOneDriveAccessToken(accountId);
      await graphRequest(
        `${GRAPH_BASE_URL}/subscriptions/${existing.subscriptionId}`,
        accessToken,
        { method: "DELETE" }
      );
    } catch {
      // Ignore
    }
  }

  await db.oneDriveAccount
    .delete({
      where: { accountId },
    })
    .catch(() => null);
}

export async function getOneDriveStatus(): Promise<OneDriveStatus> {
  const accounts = await db.oneDriveAccount.findMany({
    include: { watchChannels: true },
    orderBy: { email: "asc" },
  });

  return {
    connected: accounts.length > 0,
    accounts: accounts.map((acc) => {
      const channel = acc.watchChannels[0] ?? null;
      const expiresAt = channel?.expiration ? new Date(channel.expiration) : null;
      return {
        accountId: acc.accountId,
        email: acc.email,
        folderDriveId: acc.folderDriveId,
        folderItemId: acc.folderItemId,
        folderName: acc.folderName,
        folderPath: acc.folderPath,
        lastDeltaSyncAt: acc.lastDeltaSyncAt ? acc.lastDeltaSyncAt.toISOString() : null,
        lastSyncAt: acc.lastSyncAt ? acc.lastSyncAt.toISOString() : null,
        name: acc.name,
        subscription: {
          expiresAt: expiresAt?.toISOString() ?? null,
          resource: channel?.resource ?? null,
          status: !channel
            ? "MISSING"
            : expiresAt && expiresAt.getTime() > Date.now()
              ? "ACTIVE"
              : "EXPIRED",
          subscriptionId: channel?.subscriptionId ?? null,
        },
      };
    }),
  };
}

export async function setOneDriveFolderPath(
  accountId: string,
  selection: OneDriveFolderSelection
): Promise<void> {
  const cleanPath = selection.folderPath?.replace(/^\/+|\/+$/g, "") ?? "";
  await db.oneDriveAccount.update({
    where: { accountId },
    data: {
      folderPath: cleanPath,
      folderDriveId: selection.driveId ?? null,
      folderItemId: selection.itemId ?? null,
      folderName:
        selection.name ?? (cleanPath ? (cleanPath.split("/").at(-1) ?? cleanPath) : "Raíz"),
      deltaLink: null,
    },
  });

  await setupOneDriveSubscription(accountId).catch(() => null);
}

export async function listOneDriveDeltaItems(
  accountId: string,
  options?: {
    folderDriveId?: null | string;
    folderItemId?: null | string;
    folderPath?: string;
    force?: boolean;
    onPage?: (snapshot: { itemsSoFar: number; page: number }) => void;
  }
): Promise<{ items: OneDriveItem[]; totalPages: number }> {
  const account = await db.oneDriveAccount.findFirst({
    where: { accountId },
    select: { deltaLink: true, folderDriveId: true, folderItemId: true, folderPath: true },
  });

  if (!account) throw new Error("Account not found");

  const accessToken = await getOneDriveAccessToken(accountId);
  const configuredFolder = options?.folderPath ?? account.folderPath ?? "";
  const folderDriveId = options?.folderDriveId ?? account.folderDriveId;
  const folderItemId = options?.folderItemId ?? account.folderItemId;
  const existingDelta = options?.force ? null : account.deltaLink;

  // Use $select on the initial URL only — deltaLinks already carry their own query params.
  // Only requesting the fields used by isImportableXlsx + processOneDriveSkinTestItem
  // reduces the Graph payload by ~70% on large drives.
  const DELTA_SELECT =
    "id,name,file,folder,deleted,eTag,cTag,size,parentReference,lastModifiedDateTime,webUrl";
  const initialUrl = `${buildDeltaUrl({ driveId: folderDriveId, folderPath: configuredFolder, itemId: folderItemId })}?$select=${DELTA_SELECT}`;
  let url = existingDelta || initialUrl;

  const items: OneDriveItem[] = [];
  let totalPages = 0;
  let finalDeltaLink: string | null = null;

  while (url) {
    totalPages += 1;
    const response = await graphFetch<DeltaResponse>(url, accessToken);
    items.push(...(response.value ?? []));
    options?.onPage?.({ itemsSoFar: items.length, page: totalPages });
    url = response["@odata.nextLink"] ?? "";
    if (response["@odata.deltaLink"]) {
      finalDeltaLink = response["@odata.deltaLink"];
    }
  }

  // Single DB write at the end — avoids one UPDATE per delta page
  await db.oneDriveAccount.update({
    where: { accountId },
    data: {
      ...(finalDeltaLink ? { deltaLink: finalDeltaLink, lastDeltaSyncAt: new Date() } : {}),
      lastSyncAt: new Date(),
    },
  });

  return { items, totalPages };
}

export async function downloadOneDriveItem(
  accountId: string,
  itemId: string,
  driveId?: null | string
): Promise<Buffer> {
  const accessToken = await getOneDriveAccessToken(accountId);
  const url = driveId
    ? `${GRAPH_BASE_URL}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`
    : `${GRAPH_BASE_URL}/me/drive/items/${encodeURIComponent(itemId)}/content`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`OneDrive download failed ${response.status}: ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function getOneDriveAccessToken(accountId: string): Promise<string> {
  // Check in-memory cache first (eliminates DB hit for every file download during sync)
  const cached = _tokenCache.get(accountId);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
  }

  const account = await db.oneDriveAccount.findFirst({
    where: { accountId },
    select: { accessToken: true, refreshToken: true, expiresAt: true },
  });

  if (!account) throw new Error("OneDrive no conectado.");

  const expiresAt = Number(account.expiresAt);
  if (account.accessToken && Number.isFinite(expiresAt) && Date.now() < expiresAt - 60_000) {
    // Warm the cache from the persisted token
    _tokenCache.set(accountId, { expiresAt, token: account.accessToken });
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
    })
  );

  const newExpiresAt = String(Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000);
  const newExpiresAtMs = Number(newExpiresAt);

  // Persist to DB and warm cache atomically
  await db.oneDriveAccount.update({
    where: { accountId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? account.refreshToken,
      expiresAt: newExpiresAt,
    },
  });

  _tokenCache.set(accountId, { expiresAt: newExpiresAtMs, token: tokens.access_token });
  return tokens.access_token;
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(MICROSOFT_TOKEN_URL, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const payload = (await response.json()) as Partial<TokenResponse> & {
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? `Microsoft OAuth failed ${response.status}`);
  }
  return payload as TokenResponse;
}

function buildDeltaUrl(selection: {
  driveId?: null | string;
  folderPath?: string;
  itemId?: null | string;
}): string {
  if (selection.driveId && selection.itemId) {
    return `${GRAPH_BASE_URL}/drives/${encodeURIComponent(selection.driveId)}/items/${encodeURIComponent(selection.itemId)}/delta`;
  }
  const cleanPath = selection.folderPath?.replace(/^\/+|\/+$/g, "") ?? "";
  if (!cleanPath) {
    return `${GRAPH_BASE_URL}/me/drive/root/delta`;
  }
  return `${GRAPH_BASE_URL}/me/drive/root:/${encodeURIComponent(cleanPath).replace(/%2F/g, "/")}:/delta`;
}

export interface OneDriveFolderPreview {
  totalFiles: number;
  xlsxCount: number;
  xlsxTotalBytes: number;
}

export interface OneDriveFolderFile {
  id: string;
  name: string;
  size: number | null;
  webUrl: string | null;
  lastModifiedDateTime: string | null;
}

export async function listOneDriveFolderChildren(
  accountId: string,
  selection?: { driveId?: null | string; itemId?: null | string }
): Promise<{ folders: OneDriveFolderItem[]; xlsxCount: number; files: OneDriveFolderFile[] }> {
  const accessToken = await getOneDriveAccessToken(accountId);
  const url =
    selection?.driveId && selection.itemId
      ? `${GRAPH_BASE_URL}/drives/${encodeURIComponent(selection.driveId)}/items/${encodeURIComponent(selection.itemId)}/children`
      : `${GRAPH_BASE_URL}/me/drive/root/children`;
  const items = await listAllChildren(url, accessToken);
  const folders = items
    .filter((item) => item.folder || item.remoteItem?.folder)
    .map(toFolderItem)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const xlsxItems = items.filter(isXlsxItem);
  const files: OneDriveFolderFile[] = xlsxItems
    .map((item) => ({
      id: item.id,
      lastModifiedDateTime: item.lastModifiedDateTime ?? null,
      name: item.name,
      size: item.size ?? null,
      webUrl: item.webUrl ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return {
    files,
    folders,
    xlsxCount: xlsxItems.length,
  };
}

export async function getOneDriveFolderPreview(
  accountId: string,
  selection?: { driveId?: null | string; itemId?: null | string }
): Promise<OneDriveFolderPreview> {
  const accessToken = await getOneDriveAccessToken(accountId);
  // Use the delta API for a recursive scan — same as the sync worker
  // but we intentionally skip saving @odata.deltaLink (read-only preview).
  const baseUrl = buildDeltaUrl({ driveId: selection?.driveId, itemId: selection?.itemId });
  let url = `${baseUrl}?$select=id,name,file,folder,size`;

  let totalFiles = 0;
  let xlsxCount = 0;
  let xlsxTotalBytes = 0;

  while (url) {
    const response = await graphFetch<DeltaResponse>(url, accessToken);
    for (const item of response.value ?? []) {
      if (!item.file) continue; // skip folders and deleted items
      totalFiles += 1;
      if (isXlsxItem(item)) {
        xlsxCount += 1;
        xlsxTotalBytes += item.size ?? 0;
      }
    }
    // Use nextLink to paginate; stop when we reach deltaLink (end of snapshot)
    url = response["@odata.nextLink"] ?? "";
  }

  return { totalFiles, xlsxCount, xlsxTotalBytes };
}

async function listAllChildren(url: string, accessToken: string): Promise<OneDriveItem[]> {
  const items: OneDriveItem[] = [];
  let nextUrl = `${url}?$select=id,name,folder,file,remoteItem,parentReference,webUrl,size,lastModifiedDateTime&$top=200`;
  while (nextUrl) {
    const response = await graphFetch<ChildrenResponse>(nextUrl, accessToken);
    items.push(...(response.value ?? []));
    nextUrl = response["@odata.nextLink"] ?? "";
  }
  return items;
}

function toFolderItem(item: OneDriveItem): OneDriveFolderItem {
  const remote = item.remoteItem;
  const driveId = remote?.parentReference?.driveId ?? item.parentReference?.driveId ?? null;
  const id = remote?.id ?? item.id;
  return {
    driveId,
    hasChildren: true,
    id,
    isRemote: Boolean(remote),
    name: remote?.name ?? item.name,
    path: normalizeGraphPath(remote?.parentReference?.path ?? item.parentReference?.path ?? null),
    webUrl: remote?.webUrl ?? item.webUrl ?? null,
    xlsxCount: 0,
  };
}

function isXlsxItem(item: OneDriveItem): boolean {
  return Boolean(item.file) && /\.xlsx$/i.test(item.name) && !/^~\$/.test(item.name);
}

function normalizeGraphPath(path: null | string | undefined): null | string {
  if (!path) return null;
  return path.replace(/^\/drive\/root:\/?/, "").replace(/^\/drives\/[^/]+\/root:\/?/, "");
}

async function graphFetch<T>(url: string, accessToken: string): Promise<T> {
  return await graphRequest<T>(url, accessToken);
}

async function graphRequest<T>(
  url: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    let parsed: MicrosoftGraphError["parsed"];
    try {
      parsed = JSON.parse(body) as MicrosoftGraphError["parsed"];
    } catch {
      parsed = undefined;
    }
    throw new MicrosoftGraphError(
      `Microsoft Graph failed ${response.status}`,
      response.status,
      body,
      parsed
    );
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function setupOneDriveSubscription(accountId: string) {
  const accessToken = await getOneDriveAccessToken(accountId);
  const account = await db.oneDriveAccount.findFirst({
    where: { accountId },
    select: { folderDriveId: true, folderItemId: true, folderPath: true },
  });
  const cleanPath = account?.folderPath?.replace(/^\/+|\/+$/g, "") ?? "";
  const resource =
    account?.folderDriveId && account.folderItemId
      ? `drives/${account.folderDriveId}/items/${account.folderItemId}`
      : cleanPath
        ? `me/drive/root:/${encodeURIComponent(cleanPath).replace(/%2F/g, "/")}`
        : "me/drive/root";

  const expirationDateTime = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
  const webhookUrl = getOneDriveWebhookUrl();

  const existing = await db.oneDriveWatchChannel.findFirst({
    where: { accountId },
    select: { id: true, subscriptionId: true },
  });

  const payload = {
    changeType: "updated",
    notificationUrl: webhookUrl,
    resource: resource,
    expirationDateTime,
    clientState: ONEDRIVE_WEBHOOK_CLIENT_STATE,
  };

  logEvent("onedrive.subscription.create.request", {
    accountId,
    hasExistingSubscription: Boolean(existing),
    resource,
    webhookHost: safeUrlHost(webhookUrl),
    webhookUrl,
  });

  let sub: { id: string };
  try {
    sub = await graphRequest<{ id: string }>(`${GRAPH_BASE_URL}/subscriptions`, accessToken, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const details =
      error instanceof MicrosoftGraphError
        ? graphErrorDetails(error, webhookUrl)
        : {
            body: error instanceof Error ? error.message : String(error),
            webhookUrl,
          };
    logError("onedrive.subscription.create.failed", error, {
      accountId,
      resource,
      ...details,
    });
    throw new OneDriveSubscriptionError(
      "Microsoft Graph no pudo validar el webhook OneDrive. El sync manual/delta sigue disponible.",
      details
    );
  }

  logEvent("onedrive.subscription.create.success", {
    accountId,
    resource,
    subscriptionId: sub.id,
    webhookHost: safeUrlHost(webhookUrl),
  });

  if (existing) {
    try {
      await graphRequest(
        `${GRAPH_BASE_URL}/subscriptions/${existing.subscriptionId}`,
        accessToken,
        { method: "DELETE" }
      );
    } catch {
      // Keep going: the new subscription is already active and stored below.
      logWarn("onedrive.subscription.delete_previous.failed", {
        accountId,
        subscriptionId: existing.subscriptionId,
      });
    }
    await db.oneDriveWatchChannel.delete({ where: { id: existing.id } });
  }

  await db.oneDriveWatchChannel.create({
    data: {
      id: sub.id,
      accountId,
      subscriptionId: sub.id,
      resource,
      expiration: new Date(expirationDateTime),
      webhookUrl,
    },
  });
}

function getOneDriveWebhookUrl() {
  const explicit = process.env.ONEDRIVE_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const publicUrl = process.env.PUBLIC_URL?.trim() || "https://intranet.bioalergia.cl";
  return `${publicUrl.replace(/\/+$/g, "")}/api/webhooks/onedrive`;
}

export async function renewOneDriveSubscription(accountId: string) {
  const channel = await db.oneDriveWatchChannel.findFirst({
    where: { accountId },
    select: { id: true, subscriptionId: true, expiration: true },
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
        body: JSON.stringify({ expirationDateTime: newExpiration }),
      });

      await db.oneDriveWatchChannel.update({
        where: { id: channel.id },
        data: { expiration: new Date(newExpiration) },
      });
    } catch (error) {
      console.error(`Failed to renew OneDrive subscription for ${accountId}:`, error);
      const account = await db.oneDriveAccount.findFirst({
        where: { accountId },
        select: { accountId: true },
      });
      if (account) {
        await setupOneDriveSubscription(accountId);
      }
    }
  }
}

export async function renewOneDriveSubscriptionNow(accountId: string) {
  try {
    await setupOneDriveSubscription(accountId);
    return true;
  } catch (error) {
    if (error instanceof OneDriveSubscriptionError) {
      console.warn(error.message, {
        accountId,
        ...error.details,
      });
      return false;
    }
    throw error;
  }
}

function graphErrorDetails(error: MicrosoftGraphError, webhookUrl: string) {
  return {
    body: error.body,
    clientRequestId: error.parsed?.error?.innerError?.["client-request-id"] ?? null,
    code: error.parsed?.error?.code ?? null,
    graphMessage: error.parsed?.error?.message ?? null,
    requestId: error.parsed?.error?.innerError?.["request-id"] ?? null,
    status: error.status,
    webhookHost: safeUrlHost(webhookUrl),
    webhookUrl,
  };
}

function safeUrlHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export async function renewAllOneDriveSubscriptions() {
  const accounts = await db.oneDriveAccount.findMany({ select: { accountId: true } });
  for (const acc of accounts) {
    await renewOneDriveSubscription(acc.accountId);
  }
}
