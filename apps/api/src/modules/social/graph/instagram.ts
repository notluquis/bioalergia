// Instagram Content Publishing (Graph API): flujo de 3 pasos
//   1. crear container (media)  2. poll status_code hasta FINISHED  3. media_publish
// Soporta imagen, reel, story y carrusel. El error 9007 ("Media not ready")
// ocurre si se publica antes de FINISHED → por eso el poll es obligatorio.

import { graphGet, graphPost, type LoadedSocialAccount, requirePageToken } from "./_http.ts";

function igUserId(account: LoadedSocialAccount): string {
  if (!account.igUserId) throw new Error(`SocialAccount ${account.id} sin igUserId`);
  return account.igUserId;
}

type ContainerResponse = { id: string };
type PublishResponse = { id: string };
type StatusResponse = { status_code?: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED"; status?: string };
type PermalinkResponse = { permalink?: string };

export async function createImageContainer(
  account: LoadedSocialAccount,
  imageUrl: string,
  caption?: string,
): Promise<string> {
  const token = requirePageToken(account);
  const res = await graphPost<ContainerResponse>(
    `/${igUserId(account)}/media`,
    { image_url: imageUrl, caption },
    token,
    account.graphApiVersion,
  );
  return res.id;
}

export async function createReelContainer(
  account: LoadedSocialAccount,
  videoUrl: string,
  caption?: string,
): Promise<string> {
  const token = requirePageToken(account);
  const res = await graphPost<ContainerResponse>(
    `/${igUserId(account)}/media`,
    { media_type: "REELS", video_url: videoUrl, caption },
    token,
    account.graphApiVersion,
  );
  return res.id;
}

export async function createStoryContainer(
  account: LoadedSocialAccount,
  mediaUrl: string,
  isVideo: boolean,
): Promise<string> {
  const token = requirePageToken(account);
  const body = isVideo
    ? { media_type: "STORIES", video_url: mediaUrl }
    : { media_type: "STORIES", image_url: mediaUrl };
  const res = await graphPost<ContainerResponse>(`/${igUserId(account)}/media`, body, token, account.graphApiVersion);
  return res.id;
}

export async function createCarouselContainer(
  account: LoadedSocialAccount,
  items: { url: string; isVideo: boolean }[],
  caption?: string,
): Promise<string> {
  const token = requirePageToken(account);
  if (items.length < 2 || items.length > 10) {
    throw new Error("El carrusel de Instagram requiere entre 2 y 10 elementos");
  }
  const children: string[] = [];
  for (const item of items) {
    const child = await graphPost<ContainerResponse>(
      `/${igUserId(account)}/media`,
      item.isVideo
        ? { is_carousel_item: true, media_type: "VIDEO", video_url: item.url }
        : { is_carousel_item: true, image_url: item.url },
      token,
      account.graphApiVersion,
    );
    children.push(child.id);
  }
  const res = await graphPost<ContainerResponse>(
    `/${igUserId(account)}/media`,
    { media_type: "CAROUSEL", children, caption },
    token,
    account.graphApiVersion,
  );
  return res.id;
}

export async function getContainerStatus(
  account: LoadedSocialAccount,
  containerId: string,
): Promise<"IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED"> {
  const token = requirePageToken(account);
  const res = await graphGet<StatusResponse>(
    `/${containerId}?fields=status_code`,
    token,
    account.graphApiVersion,
  );
  return res.status_code ?? "IN_PROGRESS";
}

export async function publishContainer(account: LoadedSocialAccount, containerId: string): Promise<string> {
  const token = requirePageToken(account);
  const res = await graphPost<PublishResponse>(
    `/${igUserId(account)}/media_publish`,
    { creation_id: containerId },
    token,
    account.graphApiVersion,
  );
  return res.id;
}

export async function getPermalink(account: LoadedSocialAccount, mediaId: string): Promise<string | null> {
  const token = requirePageToken(account);
  try {
    const res = await graphGet<PermalinkResponse>(`/${mediaId}?fields=permalink`, token, account.graphApiVersion);
    return res.permalink ?? null;
  } catch {
    return null;
  }
}
