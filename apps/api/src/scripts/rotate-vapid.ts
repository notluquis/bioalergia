// VAPID key rotation playbook for the Web Push pipeline.
//
// What it does, in order:
//   1. Generates a fresh VAPID keypair via web-push.
//   2. Counts existing push_subscription rows that will be invalidated
//      (rotation MUST drop every sub — clients re-subscribe with the
//      new pub key on next opt-in).
//   3. Prints the env vars to set in BOTH services (api + intranet)
//      and on Railway. Same VITE_VAPID_PUBLIC_KEY on both sides.
//   4. With --apply: deletes every push_subscription row so nothing
//      keeps trying to sign with the old key. Without --apply: dry
//      run, prints the count only.
//
// Run from apps/api:
//   pnpm dlx tsx src/scripts/rotate-vapid.ts            # dry run
//   pnpm dlx tsx src/scripts/rotate-vapid.ts --apply    # commit
//
// After running:
//   - Update VAPID_PRIVATE_KEY + VITE_VAPID_PUBLIC_KEY in apps/api
//     Railway service vars
//   - Update VITE_VAPID_PUBLIC_KEY in apps/intranet Railway service
//     vars (same pub key as api)
//   - Update apps/api/.env locally
//   - Trigger redeploys (intranet rebuilds with new VITE_ var inlined)
//   - Operators must re-toggle push notifications in the UI

import "dotenv/config";
import { db } from "@finanzas/db";
import webpush from "web-push";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log("Generating new VAPID keypair...\n");
  const keys = webpush.generateVAPIDKeys();

  const subs = await db.pushSubscription.count();
  console.log(`Existing subscriptions in DB: ${subs}`);
  console.log(`These ${subs > 0 ? "WILL" : "would"} be deleted on --apply.\n`);

  console.log("─── New keypair ───────────────────────────────────────────────");
  console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
  console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
  console.log("───────────────────────────────────────────────────────────────\n");

  console.log("Set on Railway (api service):");
  console.log(
    `  railway variables --service api --set VAPID_PRIVATE_KEY="${keys.privateKey}" --set VITE_VAPID_PUBLIC_KEY="${keys.publicKey}"\n`
  );
  console.log("Set on Railway (intranet service):");
  console.log(
    `  railway variables --service intranet --set VITE_VAPID_PUBLIC_KEY="${keys.publicKey}"\n`
  );
  console.log("Mirror locally in apps/api/.env (so test-push.ts works).\n");

  if (!APPLY) {
    console.log("[dry run] re-run with --apply to delete existing subscriptions.");
    return;
  }

  const deleted = await db.pushSubscription.deleteMany({});
  console.log(`Deleted ${deleted.count} stale subscription(s).`);
  console.log("\nNext: redeploy both services, ask operators to re-toggle push.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
