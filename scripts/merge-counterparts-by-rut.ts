import type { RowDataPacket } from "mysql2";
import { getPool } from "../server/db.js";
import { normalizeRut } from "../server/lib/rut.js";

async function mergeDuplicates() {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query<RowDataPacket[]>("SELECT id, rut FROM mp_counterparts WHERE rut IS NOT NULL");

    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const normalized = normalizeRut(row.rut);
      if (!normalized) continue;
      const key = normalized;
      const bucket = groups.get(key) ?? [];
      bucket.push(row.id);
      groups.set(key, bucket);
    }

    const duplicates = Array.from(groups.entries()).filter(([, ids]) => ids.length > 1);
    for (const [rutKey, ids] of duplicates) {
      const sortedIds = ids.slice().sort((a, b) => a - b);
      const canonicalId = sortedIds[0];
      const redundantIds = sortedIds.slice(1);
      for (const redundantId of redundantIds) {
        const [accounts] = await connection.query<RowDataPacket[]>(
          "SELECT id, account_identifier FROM mp_counterpart_accounts WHERE counterpart_id = ?",
          [redundantId]
        );
        for (const account of accounts) {
          const identifier = account.account_identifier;
          const [existing] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM mp_counterpart_accounts WHERE counterpart_id = ? AND account_identifier = ?",
            [canonicalId, identifier]
          );
          if (existing.length) {
            await connection.query("DELETE FROM mp_counterpart_accounts WHERE id = ?", [account.id]);
          } else {
            await connection.query("UPDATE mp_counterpart_accounts SET counterpart_id = ? WHERE id = ?", [
              canonicalId,
              account.id,
            ]);
          }
        }

        await connection.query("UPDATE services SET counterpart_id = ? WHERE counterpart_id = ?", [
          canonicalId,
          redundantId,
        ]);

        await connection.query("DELETE FROM mp_counterparts WHERE id = ?", [redundantId]);
        console.log(`Merged counterpart ${redundantId} into ${canonicalId} (rut=${rutKey})`);
      }
    }

    await connection.commit();
    console.log("Duplicate rut cleanup completed.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

mergeDuplicates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to merge counterparts:", error);
    process.exit(1);
  });
