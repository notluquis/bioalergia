/* global module */
module.exports = {
  env: { browser: true, es2020: true, node: true },
  extends: [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  ignorePatterns: ["dist", ".eslintrc.js", "node_modules"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh", "@typescript-eslint", "jsx-a11y", "simple-import-sort", "import"],
  root: true,
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "import/first": "error",
    "import/newline-after-import": "error",
    "import/no-duplicates": "error",
    "jsx-a11y/alt-text": "warn",
    "jsx-a11y/aria-props": "warn",
    "jsx-a11y/aria-proptypes": "warn",
    "jsx-a11y/aria-role": "warn",
    "jsx-a11y/role-has-required-aria-props": "warn",
    "jsx-a11y/role-supports-aria-props": "warn",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "simple-import-sort/exports": "error",
    "simple-import-sort/imports": "error",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
