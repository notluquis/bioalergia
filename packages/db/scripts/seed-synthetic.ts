/**
 * Synthetic data seed for hermetic e2e / Lighthouse — FAKE data only, never PHI.
 *
 * Run AFTER `zen db push` (throwaway DB) + `seed-e2e-user.ts`, against an
 * EPHEMERAL Postgres (CI service container or local Colima/Postgres.app):
 *   DATABASE_URL=postgres://... node packages/db/scripts/seed-synthetic.ts
 *
 * Uses raw pg (not the ZenStack client) because @@deny('all', auth()==null)
 * policies block unauthenticated writes; raw SQL bypasses policy and uses the
 * physical snake_case columns. Deterministic (faker.seed) so runs are stable.
 */
import { fakerES as faker } from "@faker-js/faker";
import pg from "pg";

faker.seed(20260601);
const REF = new Date("2026-06-01T12:00:00Z");
const PATIENTS = 40;

const KINDS = ["SUBCUTANEOUS_TREATMENT", "SKIN_TEST", "MEDICAL_CONSULTATION"] as const;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  // Hard guard: refuse to seed anything that looks like prod.
  if (/railway|prod|amazonaws|\.cl\b/i.test(databaseUrl)) {
    throw new Error("[seed-synthetic] refusing to run against a non-ephemeral DATABASE_URL");
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const q = (text: string, params?: unknown[]) => pool.query(text, params);

  try {
    // Idempotent: wipe the synthetic tables (NOT users/roles from the e2e seed).
    await q(
      `TRUNCATE events, clinical_series, patients, people, calendars RESTART IDENTITY CASCADE`
    );

    const cal = await q(
      `INSERT INTO calendars (google_id) VALUES ($1) RETURNING id`,
      [`e2e-cal-${faker.string.uuid()}`]
    );
    const calendarId = cal.rows[0].id as number;

    for (let i = 0; i < PATIENTS; i++) {
      const names = faker.person.firstName();
      const father = faker.person.lastName();
      const mother = faker.person.lastName();
      const person = await q(
        `INSERT INTO people (names, father_name, mother_name, email, phone, person_type)
         VALUES ($1,$2,$3,$4,$5,'NATURAL') RETURNING id`,
        [names, father, mother, faker.internet.email(), `+5692${faker.string.numeric(7)}`]
      );
      const personId = person.rows[0].id as number;

      const patient = await q(`INSERT INTO patients (person_id) VALUES ($1) RETURNING id`, [
        personId,
      ]);
      const patientId = patient.rows[0].id as number;
      const fullName = `${names} ${father} ${mother}`;

      const series = await q(
        `INSERT INTO clinical_series (kind, patient_id, patient_name)
         VALUES ($1,$2,$3) RETURNING id`,
        [faker.helpers.arrayElement(KINDS), patientId, fullName]
      );
      const seriesId = series.rows[0].id as number;

      const eventsPerPatient = faker.number.int({ min: 1, max: 4 });
      for (let e = 0; e < eventsPerPatient; e++) {
        await q(
          `INSERT INTO events
             (calendar_id, external_event_id, clinical_series_id, patient_name, summary, start_date_time)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            calendarId,
            `e2e-evt-${faker.string.uuid()}`,
            seriesId,
            fullName,
            faker.helpers.arrayElement(["Inmunoterapia", "Control", "Test cutáneo"]),
            faker.date.between({ from: REF, to: "2026-12-31T00:00:00Z" }),
          ]
        );
      }
    }

    const counts = await q(
      `SELECT (SELECT count(*) FROM people) people, (SELECT count(*) FROM patients) patients,
              (SELECT count(*) FROM clinical_series) series, (SELECT count(*) FROM events) events`
    );
    // eslint-disable-next-line no-console
    console.log("[seed-synthetic] done", counts.rows[0]);
  } finally {
    await pool.end();
  }
}

await main();
