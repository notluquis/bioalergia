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
      // Re-enabled (gradual enforcement) - switch to 'error' once remaining anys addressed
      "@typescript-eslint/no-explicit-any": "warn",
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
      "react-refresh/only-export-components": "warn",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      // Re-enabled to surface missing dependencies (warn initially)
      "react-hooks/exhaustive-deps": "warn",
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
];
