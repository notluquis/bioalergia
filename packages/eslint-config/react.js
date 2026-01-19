import tanstackQuery from "@tanstack/eslint-plugin-query";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactCompiler from "eslint-plugin-react-compiler";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { config as baseConfig } from "./index.js";

export const config = [
  ...baseConfig,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  jsxA11y.flatConfigs.strict,
  ...tanstackQuery.configs["flat/recommended"],

  {
    files: ["**/*.tsx", "**/*.jsx"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-compiler": reactCompiler,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "react-compiler/react-compiler": "error",

      // Override naming convention for React Components (PascalCase)
      "check-file/filename-naming-convention": [
        "error",
        {
          "**/*.{tsx,jsx}": "PASCAL_CASE",
          "**/hooks/**/*.ts": "CAMEL_CASE", // React Hooks
          "**/*.{ts,js}": "KEBAB_CASE", // Default for other TS/JS
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // Re-apply prettier at the end to ensure it overrides everything
  prettier,
];

export default config;
