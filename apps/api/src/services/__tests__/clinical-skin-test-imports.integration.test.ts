/**
 * Integration tests for the OneDrive→DB skin-test import reconcile/heal logic.
 * Connects to the real PostgreSQL DB (DATABASE_URL from the environment) and
 * exercises the actual reconcile SQL the unit suite cannot reach.
 *
 * SAFETY: every fixture lives under a dedicated synthetic OneDrive account
 * (TEST_ACCOUNT). All reconcile calls are SCOPED to that account, so real
 * production rows are never touched. afterAll deletes the fixtures + account.
 * Skips gracefully when DATABASE_URL is absent (e.g. CI without a DB).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import {
  countStaleSkinTestImports,
  markVanishedSkinTestImports,
  reconcileStaleSkinTestImports,
} from "../clinical-skin-test-imports.ts";

const hasDb = Boolean(process.env.DATABASE_URL);
const TEST_ACCOUNT = "__vitest_recon_acct__";
const DRIVE = "__vitest_recon_drive__";

async function insertFixture(opts: {
  importFilename: string;
  importStatus: string;
  importWebUrl?: string;
  itemId: string;
  libraryClassification?: string;
  libraryFilename: string;
  libraryWebUrl?: string;
}) {
  // Library row (clinical_xlsx_files) = OneDrive source of truth.
  await sql`
    INSERT INTO clinical_xlsx_files
      (id, onedrive_account_id, onedrive_drive_id, onedrive_item_id, onedrive_web_url,
       path, filename, classification, created_at, updated_at)
    VALUES
      (${`f_${opts.itemId}`}, ${TEST_ACCOUNT}, ${DRIVE}, ${opts.itemId}, ${opts.libraryWebUrl ?? null},
       ${"/test"}, ${opts.libraryFilename},
       ${opts.libraryClassification ?? "SKIN_TEST"}::"ClinicalXlsxFileClassification", now(), now())
  `.execute(kysely);
  // Import row (clinical_skin_test_imports) = pre-fix stale state.
  await sql`
    INSERT INTO clinical_skin_test_imports
      (id, onedrive_account_id, onedrive_drive_id, onedrive_item_id, onedrive_web_url,
       filename, parser_version, status, created_at, updated_at)
    VALUES
      (${`i_${opts.itemId}`}, ${TEST_ACCOUNT}, ${DRIVE}, ${opts.itemId}, ${opts.importWebUrl ?? null},
       ${opts.importFilename}, ${"test"}, ${opts.importStatus}::"ClinicalSkinTestImportStatus",
       now(), now())
  `.execute(kysely);
}

async function getImportStatusAndName(itemId: string) {
  const rows = await sql<{ filename: string; status: string }>`
    SELECT status::text AS status, filename
    FROM clinical_skin_test_imports
    WHERE onedrive_account_id = ${TEST_ACCOUNT} AND onedrive_item_id = ${itemId}
  `.execute(kysely);
  return rows.rows[0];
}

async function cleanupFixtures() {
  await sql`DELETE FROM clinical_skin_test_imports WHERE onedrive_account_id = ${TEST_ACCOUNT}`.execute(
    kysely
  );
  await sql`DELETE FROM clinical_xlsx_files WHERE onedrive_account_id = ${TEST_ACCOUNT}`.execute(
    kysely
  );
}

describe.skipIf(!hasDb)("skin-test reconcile (integration, real DB)", () => {
  beforeAll(async () => {
    await sql`
      INSERT INTO onedrive_accounts
        (id, account_id, email, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES
        (${TEST_ACCOUNT}, ${TEST_ACCOUNT}, ${"vitest@example.invalid"}, ${"x"}, ${"x"}, ${"0"}, now(), now())
      ON CONFLICT (account_id) DO NOTHING
    `.execute(kysely);
  });

  afterEach(cleanupFixtures);

  afterAll(async () => {
    await cleanupFixtures();
    await sql`DELETE FROM onedrive_accounts WHERE account_id = ${TEST_ACCOUNT}`.execute(kysely);
  });

  it("counts a drifted (renamed) import as stale, scoped to the account", async () => {
    expect(await countStaleSkinTestImports(TEST_ACCOUNT)).toBe(0);
    await insertFixture({
      itemId: "rename1",
      importFilename: "_PRICK TEST ALIMENTARIO I  Sonia Urritia Neira .xlsx",
      libraryFilename: "_PRICK TEST ALIMENTARIO I (2).xlsx",
      importStatus: "PENDING_REVIEW",
    });
    expect(await countStaleSkinTestImports(TEST_ACCOUNT)).toBe(1);
  });

  it("routes a rename-to-template to TEMPLATE and syncs the filename", async () => {
    await insertFixture({
      itemId: "tmpl1",
      importFilename: "_PRICK TEST ALIMENTARIO I  Sonia Urritia Neira .xlsx",
      libraryFilename: "_PRICK TEST ALIMENTARIO I (2).xlsx",
      importStatus: "PENDING_REVIEW",
    });
    await reconcileStaleSkinTestImports({ accountId: TEST_ACCOUNT });
    const row = await getImportStatusAndName("tmpl1");
    expect(row.status).toBe("TEMPLATE");
    expect(row.filename).toBe("_PRICK TEST ALIMENTARIO I (2).xlsx");
    expect(await countStaleSkinTestImports(TEST_ACCOUNT)).toBe(0);
  });

  it("keeps a still-importable rename in the review queue (status preserved)", async () => {
    await insertFixture({
      itemId: "keep1",
      importFilename: "Maria Vieja - PRICK TEST ALIMENTARIO I.xlsx",
      libraryFilename: "Maria Nueva Soto - PRICK TEST ALIMENTARIO I.xlsx",
      importStatus: "PENDING_REVIEW",
    });
    await reconcileStaleSkinTestImports({ accountId: TEST_ACCOUNT });
    const row = await getImportStatusAndName("keep1");
    expect(row.status).toBe("PENDING_REVIEW");
    expect(row.filename).toBe("Maria Nueva Soto - PRICK TEST ALIMENTARIO I.xlsx");
  });

  it("never demotes a terminal (IMPORTED) row, only syncs its metadata", async () => {
    await insertFixture({
      itemId: "imported1",
      importFilename: "Paciente - PRICK TEST ALIMENTARIO I.xlsx",
      libraryFilename: "_PRICK TEST ALIMENTARIO I (2).xlsx",
      importStatus: "IMPORTED",
    });
    await reconcileStaleSkinTestImports({ accountId: TEST_ACCOUNT });
    const row = await getImportStatusAndName("imported1");
    expect(row.status).toBe("IMPORTED");
    expect(row.filename).toBe("_PRICK TEST ALIMENTARIO I (2).xlsx");
  });

  it("markVanished: drops non-terminal not-seen rows, preserves terminal", async () => {
    await insertFixture({
      itemId: "vanished1",
      importFilename: "Gone - PRICK TEST ALIMENTARIO I.xlsx",
      libraryFilename: "Gone - PRICK TEST ALIMENTARIO I.xlsx",
      importStatus: "DISCOVERED",
    });
    await insertFixture({
      itemId: "survivor1",
      importFilename: "Kept - PRICK TEST ALIMENTARIO I.xlsx",
      libraryFilename: "Kept - PRICK TEST ALIMENTARIO I.xlsx",
      importStatus: "IMPORTED",
    });
    // Only "survivor1" was seen in the resync enumeration.
    const n = await markVanishedSkinTestImports(TEST_ACCOUNT, new Set(["survivor1"]));
    expect(n).toBe(1);
    expect((await getImportStatusAndName("vanished1")).status).toBe("SKIPPED");
    expect((await getImportStatusAndName("survivor1")).status).toBe("IMPORTED");
  });

  it("markVanished: an empty seen-set is a no-op (never nukes everything)", async () => {
    await insertFixture({
      itemId: "safe1",
      importFilename: "Safe - PRICK TEST ALIMENTARIO I.xlsx",
      libraryFilename: "Safe - PRICK TEST ALIMENTARIO I.xlsx",
      importStatus: "DISCOVERED",
    });
    const n = await markVanishedSkinTestImports(TEST_ACCOUNT, new Set());
    expect(n).toBe(0);
    expect((await getImportStatusAndName("safe1")).status).toBe("DISCOVERED");
  });
});
