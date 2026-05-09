import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const TEMP_PREFIX = "bioalergia-upload-";
const MAX_NAME_LENGTH = 200;
const SAFE_NAME_PATTERN = /[^\w.-]+/g;
const LEADING_DOTS_PATTERN = /^\.+/;

// path.basename strips any directory components; the whitelist regex then
// removes characters that could re-introduce traversal, control sequences,
// or shell metacharacters. Leading dots are stripped so the result cannot
// become ".." or a hidden file of the attacker's choosing.
export function sanitizeUploadFilename(input: string | undefined): string {
  if (!input) return "";
  const base = path.basename(input);
  const cleaned = base.replace(SAFE_NAME_PATTERN, "_").replace(LEADING_DOTS_PATTERN, "");
  return cleaned.slice(0, MAX_NAME_LENGTH);
}

export interface TempUpload extends AsyncDisposable {
  filepath: string;
  cleanup: () => Promise<void>;
}

// Writes `data` to a uniquely-named file inside a freshly-created temp
// directory owned by this call. The caller-supplied `preferredName` is only
// used as a hint for the on-disk basename; it is sanitized so path traversal
// is impossible even if the whitelist regex were ever weakened. Use
// `await using temp = await writeTempUpload(...)` for automatic cleanup, or
// pair with `cleanup()` in a `finally` block.
export async function writeTempUpload(
  data: Buffer,
  preferredName?: string,
): Promise<TempUpload> {
  const dir = await mkdtemp(path.join(tmpdir(), TEMP_PREFIX));
  const safeName = sanitizeUploadFilename(preferredName) || `${randomUUID()}.bin`;
  const filepath = path.join(dir, safeName);
  await writeFile(filepath, data);
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true });
  };
  return {
    filepath,
    cleanup,
    [Symbol.asyncDispose]: cleanup,
  };
}
