import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import unicorn from "eslint-plugin-unicorn";
import sonarjs from "eslint-plugin-sonarjs";
import prettier from "eslint-plugin-prettier/recommended";
import eslintPlugin from "eslint-plugin-eslint-plugin";
import nodePlugin from "eslint-plugin-n";

export default tseslint.config(
  {
    ignores: ["dist"],
  },

  {
    files: ["**/*.{ts,js}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      unicorn.configs.recommended,
      sonarjs.configs.recommended,
      nodePlugin.configs["flat/recommended-module"],
      eslintPlugin.configs.recommended,
      prettier,
    ],
    rules: {
      // Disable cognitive complexity - ESLint rule logic is inherently complex
      "sonarjs/cognitive-complexity": "off",
    },
  },

  // Test files configuration
  {
    files: ["test/**/*.{ts,js}"],
    rules: {
      // Ignore import resolution for test files (build-related paths)
      "n/no-missing-import": "off",
    },
  },
);
