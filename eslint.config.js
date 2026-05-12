import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "apps/*/dist/**",
      "packages/*/dist/**",
      "coverage/**",
      ".omx/**",
      "pnpm-lock.yaml"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        AbortSignal: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        window: "readonly"
      }
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { "fixStyle": "inline-type-imports" }]
    }
  }
];
