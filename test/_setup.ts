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
 * Configured ESLint rule tester with TypeScript support for testing date-fns rules.
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
