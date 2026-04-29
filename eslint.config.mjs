import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
    },
  },
  prettierConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "out/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "supabase/.branches/**",
      "supabase/.temp/**",
      "next-env.d.ts",
    ],
  },
];
