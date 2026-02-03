import fs from "node:fs";
import path from "node:path";
import * as readline from "node:readline";
import { OAuth2Client } from "google-auth-library";

const ENV_LINE_REGEX = /^([^=]+)=(.*)$/;
const ENV_QUOTES_REGEX = /^["']|["']$/g;

// Simple .env parser to avoid adding dotenv dependency if not present
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      content.split("\n").forEach((line) => {
        const match = line.match(ENV_LINE_REGEX);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(ENV_QUOTES_REGEX, ""); // Remove quotes
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.log("📝 Loaded .env file");
    }
  } catch (e) {
    console.warn("Could not load .env file", e);
  }
}

loadEnv();

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ Error: Missing env vars.");
    console.error("Please set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env");
    process.exit(1);
  }

  const oAuth2Client = new OAuth2Client(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("\n🔐 Google Drive Authorization");
  console.log("============================");
  console.log("1. Visit this URL to authorize:");
  console.log(`\n${authUrl}\n`);
  console.log("2. Copy the authorization code provided by Google.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("3. Paste the code here: ", async (code) => {
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      console.log("\n✅ Authorization successful!");
      console.log("\nAdd this REFRESH TOKEN to your .env file:\n");
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log("\n(This token will allow the app to upload backups indefinitely)");
      process.exit(0);
    } catch (error) {
      console.error("\n❌ Error retrieving access token:", error);
      process.exit(1);
    }
  });
}

main().catch(console.error);
