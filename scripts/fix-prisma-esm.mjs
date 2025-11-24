import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generatedDir = path.join(__dirname, "../generated/prisma");

console.log("🔧 Fixing Prisma ESM imports for Prisma 7...\n");

// Prisma 7 genera solo 3 archivos principales .d.ts
const filesToFix = ["client.d.ts", "default.d.ts", "edge.d.ts"];

let fixedCount = 0;

for (const file of filesToFix) {
  const filePath = path.join(generatedDir, file);

  if (!fs.existsSync(filePath)) {
    continue;
  }

  let content = fs.readFileSync(filePath, "utf8");
  const originalContent = content;

  // Fix: Add .js extension to relative imports
  content = content.replace(/from ['"](\.[^'"]+)(?<!\.js)['"]/g, (match, p1) => {
    // Skip if already has .js
    if (p1.endsWith(".js")) return match;
    // Add .js extension
    return `from '${p1}.js'`;
  });

  // Only write if changed
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  }
}

if (fixedCount === 0) {
  console.log("ℹ️  No fixes needed - Prisma 7 imports are already correct!");
} else {
  console.log(`\n✅ Fixed ${fixedCount} file(s)`);
}
