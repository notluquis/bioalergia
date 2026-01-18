import { config as reactConfig } from "@finanzas/eslint-config/react";
import jestDom from "eslint-plugin-jest-dom";
import pluginRouter from "@tanstack/eslint-plugin-router";
import path from "node:path";

export default [
  ...reactConfig,
  ...pluginRouter.configs["flat/recommended"],
  {
    ignores: [
      "dist",
      "node_modules",
      "generated",
      ".conda/**",
      "**/routeTree.gen.ts",
      "test/**",
      "*.config.ts",
      "*.config.js",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.mjs", "*.cjs", "*.ts", "*.tsx", "*.config.ts", "eslint.config.js"],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Disable filename/folder naming convention for file-based routing
  // (Required for TanStack Router conventions like _authed, $postId, etc.)
  {
    files: ["src/routes/**/*"],
    rules: {
      "check-file/filename-naming-convention": "off",
      "check-file/folder-naming-convention": "off",
    },
  },

  // Allow camelCase for stores (Redux/Zustand pattern)
  {
    files: ["src/store/**/*.ts"],
    rules: {
      "check-file/filename-naming-convention": ["error", { "**/*.ts": "CAMEL_CASE" }],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPOSITORY PATTERN ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    files: ["server/routes/**/*.ts", "server/routes/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db", "**/db.js", "**/db.ts", "../db", "../db.js", "../db.ts"],
              message:
                "Direct DB imports are prohibited in route handlers. Use domain repositories from server/repositories/ instead.",
            },
          ],
        },
      ],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DESIGN SYSTEM ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: String.raw`Literal[value=/#[0-9a-fA-F]{3,6}|rgba?\(/]`,
          message:
            "Hard-coded hex/rgb colors forbidden. Use DaisyUI tokens (primary, success, error, etc.) or CSS variables instead.",
        },
      ],
    },
  },

  // Temporary exemptions for routes pending repository pattern migration
  {
    files: [
      "server/routes/timesheets.ts",
      "server/routes/auth.ts",
      "server/routes/balances.ts",
      "server/routes/calendar-events.ts",
      "server/routes/counterparts.ts",
      "server/routes/employees.ts",
      "server/routes/loans.ts",
      "server/routes/monthly-expenses.ts",
      "server/routes/roles.ts",
      "server/routes/services.ts",
      "server/routes/settings.ts",
      "server/routes/supplies.ts",
      "server/routes/transactions.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TESTING
  // ═══════════════════════════════════════════════════════════════════════════
  {
    files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
    plugins: { "jest-dom": jestDom },
    rules: {
      ...jestDom.configs.recommended.rules,
    },
  },
];
