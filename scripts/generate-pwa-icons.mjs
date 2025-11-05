#!/usr/bin/env node
import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// Icon sizes needed for PWA manifest
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const inputPath = join(projectRoot, "public", "logo_sin_eslogan.png");
  const outputDir = join(projectRoot, "public", "icons");

  // Create icons directory if it doesn't exist
  await mkdir(outputDir, { recursive: true });

  console.log("🎨 Generating PWA icons from logo_sin_eslogan.png...\n");

  for (const size of SIZES) {
    const outputPath = join(outputDir, `icon-${size}.png`);

    try {
      await sharp(inputPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated icon-${size}.png (${size}x${size})`);
    } catch (error) {
      console.error(`❌ Error generating icon-${size}.png:`, error.message);
      process.exit(1);
    }
  }

  console.log("\n✨ All PWA icons generated successfully!");
  console.log(`📁 Icons saved to: ${outputDir}`);
}

generateIcons().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
