import { db } from "@finanzas/db";

async function main() {
  console.log("--- DIANOSTIC START ---");
  try {
    const eventCount = await db.event.count();
    console.log(`Total Events in DB: ${eventCount}`);

    const calendars = await db.calendar.findMany();
    console.log(
      `Calendars: ${calendars.map((c) => `${c.googleId} (ID: ${c.id})`).join(", ")}`
    );

    if (eventCount > 0) {
      const sampleEvents = await db.event.findMany({
        take: 5,
        orderBy: { startDateTime: "desc" },
        select: {
          id: true,
          summary: true,
          startDateTime: true,
          startDate: true,
        },
      });
      console.log("Latest 5 timed events:");
      console.log(JSON.stringify(sampleEvents, null, 2));

      const sampleDateEvents = await db.event.findMany({
        take: 5,
        where: { startDateTime: null },
        orderBy: { startDate: "desc" },
        select: { id: true, summary: true, startDate: true },
      });
      console.log("Latest 5 all-day events:");
      console.log(JSON.stringify(sampleDateEvents, null, 2));
    }

    // Check settings
    const settings = await db.setting.findMany();
    console.log("Settings in DB:", JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("Error connecting to DB:", e);
  }
  console.log("--- DIAGNOSTIC END ---");
}

main();
