import { config } from "@finanzas/eslint-config";

export default [
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  ...config,
  {
    ignores: ["dist", "generated", "zenstack/generated"],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.js",
            "*.mjs",
            "*.cjs",
            "*.ts",
            "eslint.config.js",
            "scripts/*.mjs",
          ],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["scripts/**/*.mjs", "scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];
