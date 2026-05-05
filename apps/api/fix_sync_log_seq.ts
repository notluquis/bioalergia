async function main() {
  const dbMod = await import('@finanzas/db');
  const { sql } = await import('kysely');
  const kysely = dbMod.kysely;

  const result = await sql<{ setval: number }>`
    SELECT setval(
      pg_get_serial_sequence('doctoralia_sync_logs', 'id'),
      COALESCE((SELECT MAX(id) FROM doctoralia_sync_logs), 0)
    )
  `.execute(kysely);

  console.log('sequence reset to:', result.rows[0]?.setval);
  process.exit(0);
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
