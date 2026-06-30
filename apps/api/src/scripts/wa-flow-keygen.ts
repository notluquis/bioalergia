// One-off: generate the RSA keypair for the WhatsApp Flows endpoint, store the
// private key ENCRYPTED in Settings (wa.flow.privateKeyEnc) + the public key in
// Settings (wa.flow.publicKey), and print the public key to register with Meta.
//
// Run: cd apps/api && DATABASE_URL="…" node src/scripts/wa-flow-keygen.ts
// Then register the printed public key: WhatsApp Manager → Flows → (your flow)
// → Endpoint → "Sign public key" / Graph `/{phone_number_id}/whatsapp_business_
// encryption`. Re-running rotates the key (re-register afterwards).

import { db } from "@finanzas/db";
import { generateFlowKeypair } from "../lib/flow-crypto.ts";
import { encryptSecret } from "../lib/secret-cipher.ts";

const { publicKeyPem, privateKeyPem } = generateFlowKeypair();

await db.setting.upsert({
  where: { key: "wa.flow.privateKeyEnc" },
  create: { key: "wa.flow.privateKeyEnc", value: encryptSecret(privateKeyPem) },
  update: { value: encryptSecret(privateKeyPem) },
});
await db.setting.upsert({
  where: { key: "wa.flow.publicKey" },
  create: { key: "wa.flow.publicKey", value: publicKeyPem },
  update: { value: publicKeyPem },
});

console.log("✅ Stored wa.flow.privateKeyEnc (encrypted) + wa.flow.publicKey in Settings.\n");
console.log("=== PUBLIC KEY — register this with Meta (Flows endpoint encryption) ===\n");
console.log(publicKeyPem);
process.exit(0);
