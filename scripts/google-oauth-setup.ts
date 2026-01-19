#!/usr/bin/env npx tsx

/**
 * Google OAuth Setup Script
 *
 * This script helps you obtain a refresh token for Google Drive access.
 * Run once to authorize, then copy the refresh token to your environment variables.
 *
 * Usage:
 *   npm run google:auth
 *
 * Prerequisites:
 *   1. Create OAuth 2.0 credentials in Google Cloud Console (Desktop app type)
 *   2. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET env vars
 */

import * as readline from "node:readline";
import { OAuth2Client } from "google-auth-library";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // Create/edit files
];

async function main() {
  console.log("\n🔐 Google Drive OAuth Setup\n");
  console.log("Este script te ayudará a obtener un refresh token para Google Drive.\n");

  // Check for required env vars
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ Faltan variables de entorno:");
    console.error("   - GOOGLE_OAUTH_CLIENT_ID");
    console.error("   - GOOGLE_OAUTH_CLIENT_SECRET");
    console.error("\n📝 Pasos:");
    console.error("   1. Ve a https://console.cloud.google.com/apis/credentials");
    console.error('   2. Crea "OAuth 2.0 Client ID" (tipo: Desktop app)');
    console.error("   3. Copia el Client ID y Client Secret");
    console.error(
      "   4. Ejecuta: GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy npm run google:auth",
    );
    process.exit(1);
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent to get refresh token
  });

  console.log("📋 Paso 1: Abre esta URL en tu navegador:\n");
  console.log(`   ${authUrl}\n`);
  console.log("📋 Paso 2: Autoriza la aplicación con tu cuenta de Google\n");
  console.log("📋 Paso 3: Copia el código de autorización que te muestra\n");

  // Read authorization code from user
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const code = await new Promise<string>((resolve) => {
    rl.question("🔑 Pega el código de autorización aquí: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!code) {
    console.error("❌ No se proporcionó código de autorización");
    process.exit(1);
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    console.log("\n✅ ¡Autorización exitosa!\n");
    console.log("━".repeat(60));
    console.log("\n📝 Agrega estas variables de entorno a Railway:\n");

    console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);

    console.log(`\n${"━".repeat(60)}`);
    console.log("\n⚠️  IMPORTANTE: Guarda el refresh_token de forma segura.");
    console.log("    No expira a menos que revoques el acceso manualmente.\n");

    // Test the token
    oauth2Client.setCredentials(tokens);
    const accessToken = await oauth2Client.getAccessToken();

    if (accessToken.token) {
      console.log("✅ Token verificado correctamente\n");
    }
  } catch (error) {
    console.error("\n❌ Error al obtener tokens:", error);
    process.exit(1);
  }
}

main().catch(console.error);
