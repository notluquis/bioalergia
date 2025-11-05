// Flat ESLint config migrated from .eslintrc.js for ESLint v9
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist", "node_modules", "generated"],
  },
  js.configs.recommended,
  // Base TS rules
  {
    plugins: { "@typescript-eslint": tseslint },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Provide browser + node globals to avoid no-undef noise
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        AbortController: "readonly",
        fetch: "readonly",
        File: "readonly",
        FormData: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Response: "readonly",
        Request: "readonly",
        RequestInit: "readonly",
        Image: "readonly",
        CustomEvent: "readonly",
        Buffer: "readonly",
        process: "readonly",
        DOMException: "readonly",
        alert: "readonly",
        confirm: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      // Strict enforcement: catch any types to improve type safety
      "@typescript-eslint/no-explicit-any": "error",
      // Disable core rules that conflict with TS awareness
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },
  // React recommended via plugin flat config recommended.recommended
  {
    plugins: { react },
    ...react.configs.flat.recommended,
  },
  // React hooks + refresh additions and overrides
  {
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      // Re-enabled for safer component export patterns (warn for now)
      "react-refresh/only-export-components": "off", // Allow hooks to be exported from context files
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      // Strict enforcement: prevent infinite loops and missing dependencies
      "react-hooks/exhaustive-deps": "error",
    },
    settings: { react: { version: "detect" } },
  },
  // Overrides for TypeScript files only (ensure core rules remain off)
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  // Repository pattern enforcement: prohibit direct DB imports in route handlers
  {
    files: ["server/routes/**/*.ts", "server/routes/**/*.js"],
    ignores: ["server/routes/timesheets.ts"], // Temporary: pending repository pattern migration
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
];
