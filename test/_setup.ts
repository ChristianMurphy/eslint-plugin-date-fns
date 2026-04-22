import test, { describe, after as afterAll } from "node:test";
import { RuleTester } from "@typescript-eslint/rule-tester";
import * as tsParser from "@typescript-eslint/parser";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Configure RuleTester to use Node.js test runner
RuleTester.describe = describe;
RuleTester.it = test;
RuleTester.itOnly = test.only;
RuleTester.itSkip = test.skip;
RuleTester.afterAll = afterAll;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configured ESLint rule tester with full TypeScript type information.
 * This is the primary tester rules are validated against.
 */
export const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: path.resolve(__dirname, ".."),
    },
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

/**
 * RuleTester without TypeScript project services — simulates environments
 * where type information is absent (oxlint's JS plugin API, or plain ESLint
 * with a non-TS parser). Rules must still run without throwing and may
 * produce a subset of the type-aware diagnostics.
 */
export const astOnlyTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    ecmaVersion: 2022,
    sourceType: "module",
  },
});
