import test, { describe, after as afterAll } from "node:test";
import {
  RuleTester,
  type InvalidTestCase,
  type ValidTestCase,
} from "@typescript-eslint/rule-tester";
import type { RuleModule } from "@typescript-eslint/utils/ts-eslint";
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

/**
 * Extends InvalidTestCase with a `typeAwareOnly` flag. Cases marked
 * `typeAwareOnly: true` fire only when the TypeScript type checker is
 * available — under `astOnlyTester` (and therefore under oxlint), they'd
 * silently skip, so we exclude them from the AST-only run.
 */
export type DualInvalidCase<
  MessageIds extends string,
  Options extends readonly unknown[],
> = InvalidTestCase<MessageIds, Options> & {
  readonly typeAwareOnly?: boolean;
};

/**
 * Extends ValidTestCase with a `typeAwareOnly` flag. Some "valid" cases
 * are only valid because the type checker rules them out (e.g. receiver
 * typed `any` or `unknown` skips boundary-math checks). Under AST-only,
 * the rule has no way to know, and may fire. We exclude such cases from
 * the AST-only run rather than contort rule logic to accommodate them.
 */
export type DualValidCase<Options extends readonly unknown[]> =
  | string
  | (ValidTestCase<Options> & { readonly typeAwareOnly?: boolean });

export interface DualRunConfig<
  MessageIds extends string,
  Options extends readonly unknown[],
> {
  readonly valid: readonly DualValidCase<Options>[];
  readonly invalid: readonly DualInvalidCase<MessageIds, Options>[];
}

function isTypeAwareOnlyValid<Options extends readonly unknown[]>(
  c: DualValidCase<Options>,
): boolean {
  return typeof c !== "string" && c.typeAwareOnly === true;
}

/**
 * Runs a rule's test config against both the full-type-info tester and
 * the AST-only tester. Valid cases must pass under both unless tagged
 * `typeAwareOnly`. Invalid cases run under both unless tagged
 * `typeAwareOnly`, in which case they run only under the type-aware
 * tester.
 */
export function runOnBoth<
  MessageIds extends string,
  Options extends readonly unknown[],
>(
  name: string,
  rule: RuleModule<MessageIds, Options>,
  config: DualRunConfig<MessageIds, Options>,
): void {
  tester.run(name, rule, {
    valid: config.valid.map((c) =>
      typeof c === "string" ? c : stripTypeAwareFlag(c),
    ),
    invalid: config.invalid.map((c) => stripTypeAwareFlag(c)),
  });

  const astValid = config.valid.filter((c) => !isTypeAwareOnlyValid(c));
  const astInvalid = config.invalid.filter((c) => !c.typeAwareOnly);
  if (astValid.length === 0 && astInvalid.length === 0) return;
  astOnlyTester.run(`${name} (ast-only)`, rule, {
    valid: astValid.map((c) =>
      typeof c === "string" ? c : stripTypeAwareFlag(c),
    ),
    invalid: astInvalid.map((c) => stripTypeAwareFlag(c)),
  });
}

function stripTypeAwareFlag<T extends { typeAwareOnly?: boolean }>(
  c: T,
): Omit<T, "typeAwareOnly"> {
  const copy = { ...c };
  Reflect.deleteProperty(copy, "typeAwareOnly");
  return copy;
}
