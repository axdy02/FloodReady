import tseslint from "typescript-eslint";

export default [
  ...tseslint.configs.recommended,
  {
    ignores: [".next/**", "coverage/**", "node_modules/**", "playwright-report/**", "test-results/**"]
  }
];
