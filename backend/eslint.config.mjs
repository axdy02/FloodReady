import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as", objectLiteralTypeAssertions: "never" }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "no-console": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-unreachable": "error",
      "no-warning-comments": ["error", { location: "anywhere", terms: ["todo", "fixme"] }]
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        fetch: "readonly"
      }
    },
    rules: {
      "no-console": "error"
    }
  },
  {
    ignores: [".acceptance/**", "dist/**", "node_modules/**", "src/generated/**"]
  }
);
