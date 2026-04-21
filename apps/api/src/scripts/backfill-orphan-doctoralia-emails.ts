import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

// Backfills DoctoraliaEmailNotification rows stuck with calendarAppointmentId=null
// by searching for a matching DoctoraliaCalendarAppointment in a ±1min window
// with normalized patient-name equality. When a matched email is a CANCELLATION
// the appointment's status is flipped to DOCTORALIA_STATUS_CANCELLED, which is
// how we catch cancellations that never surface in the alerts feed.
//
// Run with:
//   pnpm --filter @finanzas/api exec tsx src/scripts/backfill-orphan-doctoralia-emails.ts
//   pnpm --filter @finanzas/api exec tsx src/scripts/backfill-orphan-doctoralia-emails.ts --dry-run

async function main() {
  const { db } = await import("@finanzas/db");
  const { DOCTORALIA_STATUS_CANCELLED, buildDoctoraliaMatchWindow, normalizePatientNameForMatch } =
    await import("../lib/doctoralia/name-match");

  const dryRun = process.argv.includes("--dry-run");
  const prefix = dryRun ? "[DRY RUN] " : "";

  const orphans = await db.doctoraliaEmailNotification.findMany({
    where: {
      calendarAppointmentId: null,
      appointmentDate: { not: null },
    },
    select: {
      id: true,
      patientName: true,
      eventType: true,
      appointmentDate: true,
    },
    orderBy: { appointmentDate: "asc" },
  });

  console.log(`${prefix}Found ${orphans.length} orphan email notification(s).`);

  let linked = 0;
  let cancellationApplied = 0;
  let unmatched = 0;

  for (const orphan of orphans) {
    if (!orphan.appointmentDate) {
      unmatched++;
      continue;
    }

    const { windowStart, windowEnd } = buildDoctoraliaMatchWindow(orphan.appointmentDate);
    const target = normalizePatientNameForMatch(orphan.patientName);

    const candidates = await db.doctoraliaCalendarAppointment.findMany({
      where: { startAt: { gte: windowStart, lte: windowEnd } },
      select: { id: true, title: true, status: true },
    });

    const match = candidates.find(
      (c) => normalizePatientNameForMatch(c.title) === target,
    );

    if (!match) {
      unmatched++;
      continue;
    }

    const isCancellation = orphan.eventType === "CANCELLATION";
    console.log(
      `${prefix}email ${orphan.id} (${orphan.eventType}, ${orphan.patientName}) → appointment ${match.id}${
        isCancellation && match.status !== DOCTORALIA_STATUS_CANCELLED ? " + status→CANCELLED" : ""
      }`,
    );

    if (dryRun) {
      linked++;
      if (isCancellation && match.status !== DOCTORALIA_STATUS_CANCELLED) cancellationApplied++;
      continue;
    }

    await db.doctoraliaEmailNotification.update({
      where: { id: orphan.id },
      data: { calendarAppointmentId: match.id },
    });
    linked++;

    if (isCancellation && match.status !== DOCTORALIA_STATUS_CANCELLED) {
      await db.doctoraliaCalendarAppointment.update({
        where: { id: match.id },
        data: { status: DOCTORALIA_STATUS_CANCELLED },
      });
      cancellationApplied++;
    }
  }

  console.log(
    `${prefix}Done. linked=${linked}, cancellationApplied=${cancellationApplied}, unmatched=${unmatched}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
