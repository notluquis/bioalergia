/**
 * PostgreSQL-backed Baileys auth state.
 * Replaces the file-based `useMultiFileAuthState` with DB persistence
 * using the project's existing Kysely connection.
 *
 * Tables:
 *   - baileys_auth_creds: single row with full creds JSON
 *   - baileys_auth_keys: (type, id) → value for signal protocol keys
 */
import { kysely } from "@finanzas/db";
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataSet,
  type SignalDataTypeMap,
  type SignalKeyStore,
} from "baileys";
import type { Kysely } from "kysely";

interface BaileysAuthCredsRow {
  creds: string;
  id: string;
  updated_at: Date;
}

interface BaileysAuthKeysRow {
  id: string;
  type: string;
  updated_at: Date;
  value: string;
}

interface BaileysAuthDb {
  baileys_auth_creds: BaileysAuthCredsRow;
  baileys_auth_keys: BaileysAuthKeysRow;
}

const db = kysely as unknown as Kysely<BaileysAuthDb>;
const SESSION_ID = "default";

function serialize(data: unknown): string {
  return JSON.stringify(data, BufferJSON.replacer);
}

function deserialize<T>(raw: string): T {
  return JSON.parse(raw, BufferJSON.reviver) as T;
}

async function readCreds(): Promise<AuthenticationCreds | null> {
  const row = await db
    .selectFrom("baileys_auth_creds")
    .select("creds")
    .where("id", "=", SESSION_ID)
    .executeTakeFirst();

  if (!row) return null;

  const raw = typeof row.creds === "string" ? row.creds : JSON.stringify(row.creds);
  return deserialize<AuthenticationCreds>(raw);
}

async function writeCreds(creds: AuthenticationCreds): Promise<void> {
  const serialized = serialize(creds);
  await db
    .insertInto("baileys_auth_creds")
    .values({
      creds: serialized,
      id: SESSION_ID,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({
        creds: serialized,
        updated_at: new Date(),
      }),
    )
    .execute();
}

async function readKey<T extends keyof SignalDataTypeMap>(
  type: T,
  ids: string[],
): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
  if (ids.length === 0) return {};

  const rows = await db
    .selectFrom("baileys_auth_keys")
    .select(["id", "value"])
    .where("type", "=", type)
    .where("id", "in", ids)
    .execute();

  const result: { [id: string]: SignalDataTypeMap[T] } = {};
  for (const row of rows) {
    const raw = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
    let value = deserialize(raw);
    // Special handling for app-state-sync-key
    if (type === "app-state-sync-key" && value) {
      value = proto.Message.AppStateSyncKeyData.fromObject(value as Record<string, unknown>);
    }
    result[row.id] = value as SignalDataTypeMap[T];
  }

  return result;
}

async function writeKeys(data: SignalDataSet): Promise<void> {
  for (const category in data) {
    const categoryData = data[category as keyof SignalDataSet];
    if (!categoryData) continue;

    for (const id in categoryData) {
      const value = categoryData[id];
      if (value != null) {
        const serialized = serialize(value);
        await db
          .insertInto("baileys_auth_keys")
          .values({
            id,
            type: category,
            updated_at: new Date(),
            value: serialized,
          })
          .onConflict((oc) =>
            oc.columns(["type", "id"]).doUpdateSet({
              updated_at: new Date(),
              value: serialized,
            }),
          )
          .execute();
      } else {
        // null value means delete
        await db
          .deleteFrom("baileys_auth_keys")
          .where("type", "=", category)
          .where("id", "=", id)
          .execute();
      }
    }
  }
}

/**
 * Creates a DB-backed auth state for Baileys.
 * Drop-in replacement for `useMultiFileAuthState`.
 */
/**
 * Clear all Baileys auth state from the DB.
 * Forces a fresh QR scan on next connection.
 */
export async function clearAuthState(): Promise<void> {
  await db.deleteFrom("baileys_auth_keys").execute();
  await db.deleteFrom("baileys_auth_creds").execute();
}

export async function usePostgresAuthState(): Promise<{
  saveCreds: () => Promise<void>;
  state: AuthenticationState;
}> {
  const creds = (await readCreds()) ?? initAuthCreds();

  const keys: SignalKeyStore = {
    get: async (type, ids) => readKey(type, ids),
    set: async (data) => writeKeys(data),
    clear: async () => {
      await db.deleteFrom("baileys_auth_keys").execute();
      await db.deleteFrom("baileys_auth_creds").execute();
    },
  };

  return {
    saveCreds: () => writeCreds(creds),
    state: { creds, keys },
  };
}
