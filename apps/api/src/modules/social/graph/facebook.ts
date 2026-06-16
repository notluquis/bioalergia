// Facebook Page publishing (Graph API). Foto al feed y post de texto/enlace son
// síncronos (sin container). Reel de FB usa upload resumable → diferido.

import { graphPost, type LoadedSocialAccount, requirePageToken } from "./_http.ts";

function pageId(account: LoadedSocialAccount): string {
  if (!account.fbPageId) throw new Error(`SocialAccount ${account.id} sin fbPageId`);
  return account.fbPageId;
}

type PhotoResponse = { id?: string; post_id?: string };
type FeedResponse = { id: string };

export async function publishFbPhoto(
  account: LoadedSocialAccount,
  imageUrl: string,
  message?: string,
): Promise<string> {
  const token = requirePageToken(account);
  const res = await graphPost<PhotoResponse>(
    `/${pageId(account)}/photos`,
    { url: imageUrl, caption: message, message },
    token,
    account.graphApiVersion,
  );
  return res.post_id ?? res.id ?? "";
}

export async function publishFbFeed(account: LoadedSocialAccount, message: string): Promise<string> {
  const token = requirePageToken(account);
  const res = await graphPost<FeedResponse>(`/${pageId(account)}/feed`, { message }, token, account.graphApiVersion);
  return res.id;
}
