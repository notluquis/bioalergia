// Manual smoke test for the Web Push pipeline. Loads the api's
// existing db + notifications service and dispatches a broadcast
// notification to every subscribed device.
//
// Run from the apps/api directory:
//   pnpm dlx tsx src/scripts/test-push.ts
//
// Requires VITE_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in process.env
// (loaded automatically from apps/api/.env when run via tsx).

import "dotenv/config";
import { db } from "@finanzas/db";
import { broadcastPushNotification } from "../services/notifications.ts";

async function main() {
  const subs = await db.pushSubscription.findMany();
  console.log(`Active subscriptions in DB: ${subs.length}`);
  if (subs.length === 0) {
    console.log("No subscriptions — opt-in en el browser primero.");
    return;
  }
  for (const s of subs) {
    console.log(`  · user=${s.userId} endpoint=${s.endpoint.slice(0, 60)}…`);
  }
  const res = await broadcastPushNotification({
    title: "Bioalergia · Test push",
    body: `Push funciona ✓ — ${new Date().toLocaleTimeString("es-CL")}`,
    url: "/wa-cloud",
    tag: "test-push",
  });
  console.log("Result:", res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
