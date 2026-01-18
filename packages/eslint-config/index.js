import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";
import security from "eslint-plugin-security";
import perfectionist from "eslint-plugin-perfectionist";
import unusedImports from "eslint-plugin-unused-imports";
import checkFile from "eslint-plugin-check-file";
import turbo from "eslint-plugin-turbo";
import prettier from "eslint-config-prettier";
import globals from "globals";

export const config = [
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  security.configs.recommended,
  perfectionist.configs["recommended-natural"],

  // Base Ignore Patterns
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/generated/**",
      "**/.turbo/**",
    ],
  },

  // TypeScript & Global Rules
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      "unused-imports": unusedImports,
      "check-file": checkFile,
      turbo: turbo,
    },
    rules: {
      // --------------------------------------------------------
      // Unused Imports & Vars
      // --------------------------------------------------------
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],

      // --------------------------------------------------------
      // Perfectionist (Sorting) - Replaces simple-import-sort
      // --------------------------------------------------------
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          groups: [
            ["builtin", "external"],
            "internal-type",
            "internal",
            ["parent-type", "sibling-type", "index-type"],
            ["parent", "sibling", "index"],
            "side-effect",
            "style",
            "object",
            "unknown",
          ],
        },
      ],
      "perfectionist/sort-objects": "off",

      // --------------------------------------------------------
      // File Naming (Check File)
      // --------------------------------------------------------
      "check-file/filename-naming-convention": [
        "error",
        {
          "**/*.{ts,tsx,js,jsx}": "KEBAB_CASE",
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "src/**/": "KEBAB_CASE",
        },
      ],

      // --------------------------------------------------------
      // Turbo
      // --------------------------------------------------------
      "turbo/no-undeclared-env-vars": "error",

      // --------------------------------------------------------
      // Unicorn Overrides
      // --------------------------------------------------------
      "unicorn/prevent-abbreviations": "off",
      "unicorn/no-null": "off",
      "unicorn/filename-case": "off", // Handled by check-file
      "unicorn/prefer-module": "off",

      // --------------------------------------------------------
      // TypeScript Overrides
      // --------------------------------------------------------
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: false,
        },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
        },
      ],
    },
  },
  prettier,
];

export default config;
