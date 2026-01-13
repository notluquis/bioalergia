// Flat ESLint config - Golden Standard 2026
// React 19 + TypeScript + Strict Type-Checking
import js from "@eslint/js";
import pluginRouter from "@tanstack/eslint-plugin-router";
import reactQuery from "@tanstack/eslint-plugin-query";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import jestDom from "eslint-plugin-jest-dom";
import jsxA11y from "eslint-plugin-jsx-a11y";
import promise from "eslint-plugin-promise";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import globals from "globals";

export default [
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
  js.configs.recommended,

  // ═══════════════════════════════════════════════════════════════════════════
  // UNICORN - Modern JavaScript/TypeScript best practices (100+ rules)
  // ═══════════════════════════════════════════════════════════════════════════
  unicorn.configs.recommended,
  {
    rules: {
      // Disable overly strict rules
      "unicorn/prevent-abbreviations": "off", // Too opinionated (e.g., "props", "err", "fn")
      "unicorn/no-null": "off", // null is valid in DOM APIs and Prisma
      "unicorn/filename-case": "off", // We use PascalCase for components
      "unicorn/no-array-reduce": "off", // reduce is fine for simple aggregations
      "unicorn/no-array-for-each": "off", // forEach is readable for side effects
      "unicorn/prefer-top-level-await": "off", // Not always applicable
      "unicorn/prefer-module": "off", // CommonJS still used in configs
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SONARJS - Bug detection, code smells, cognitive complexity
  // ═══════════════════════════════════════════════════════════════════════════
  sonarjs.configs.recommended,
  {
    rules: {
      "sonarjs/cognitive-complexity": ["error", 20], // Slightly higher than default 15
      "sonarjs/no-duplicate-string": ["error", { threshold: 5 }], // Allow some duplication
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMISE - Async/await best practices
  // ═══════════════════════════════════════════════════════════════════════════
  {
    plugins: { promise },
    rules: {
      ...promise.configs.recommended.rules,
      "promise/always-return": "off", // Conflicts with React Query patterns
      "promise/catch-or-return": ["error", { allowFinally: true }],
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPESCRIPT - Strict type-checked rules
  // ═══════════════════════════════════════════════════════════════════════════
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Core TS rules
      // Core TS rules (defaults restored to error)
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "sonarjs/prefer-read-only-props": "off",

      // Unicorn - Restored preferences
      "unicorn/no-array-sort": "warn",
      "unicorn/consistent-function-scoping": "warn",
      "unicorn/prefer-add-event-listener": "warn",

      // Disable core rules that conflict with TS
      "no-unused-vars": "off",
      "no-undef": "off",
      "require-await": "off",
      "no-return-await": "off",
      "no-void": "off",
    },
  },

  // Environment-specific globals
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["server/**/*.{ts,js}", "scripts/**/*.{ts,js}", "*.config.{js,ts}", "eslint.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORTS - Sorting and validation
  // ═══════════════════════════════════════════════════════════════════════════
  {
    plugins: { "simple-import-sort": simpleImportSort, import: importPlugin },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-useless-path-segments": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      // Disable rules that TS handles or conflict with simple-import-sort
      "import/order": "off",
      "import/named": "off",
      "import/namespace": "off",
      "import/default": "off",
      "import/no-unresolved": "off",
      "import/no-cycle": "off",
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REACT - Component and hooks rules
  // ═══════════════════════════════════════════════════════════════════════════
  {
    plugins: { react },
    ...react.configs.flat.recommended,
  },
  {
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": "off",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
    settings: { react: { version: "detect" } },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCESSIBILITY - Strict mode for maximum accessibility
  // ═══════════════════════════════════════════════════════════════════════════
  jsxA11y.flatConfigs.strict,

  // ═══════════════════════════════════════════════════════════════════════════
  // SECURITY
  // ═══════════════════════════════════════════════════════════════════════════
  security.configs.recommended,

  // ═══════════════════════════════════════════════════════════════════════════
  // REACT QUERY - Best practices
  // ═══════════════════════════════════════════════════════════════════════════
  ...reactQuery.configs["flat/recommended"],

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERRIDES - TypeScript-specific adjustments
  // ═══════════════════════════════════════════════════════════════════════════
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      // Security rules that conflict with TS patterns
      "security/detect-object-injection": "off",
      "security/detect-unsafe-regex": "off",
      "security/detect-non-literal-regexp": "off",
      "security/detect-possible-timing-attacks": "off",
      "security/detect-non-literal-fs-filename": "off",
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
  // TANSTACK ROUTER - Best practices
  // ═══════════════════════════════════════════════════════════════════════════
  ...pluginRouter.configs["flat/recommended"],

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
