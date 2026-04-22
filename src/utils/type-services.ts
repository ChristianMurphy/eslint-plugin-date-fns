import {
  ESLintUtils,
  type ParserServices,
  type ParserServicesWithTypeInformation,
  type TSESLint,
} from "@typescript-eslint/utils";
import type * as ts from "typescript";

type UnknownRuleContext = TSESLint.RuleContext<string, readonly unknown[]>;

/**
 * Returns parser services if the parser provides them, otherwise undefined.
 * Safe to call under any ESLint-compatible linter, including oxlint, where
 * typescript-eslint's parser services may be absent.
 */
export function tryGetParserServices(
  context: UnknownRuleContext,
): ParserServices | undefined {
  try {
    return ESLintUtils.getParserServices(context);
  } catch {
    return undefined;
  }
}

/**
 * Narrows ParserServices to the variant that carries a TypeScript program.
 */
export function hasFullTypeInformation(
  services: ParserServices | undefined,
): services is ParserServicesWithTypeInformation {
  return (
    services !== undefined &&
    "program" in services &&
    services.program !== null &&
    services.program !== undefined
  );
}

/**
 * Returns the TypeScript checker when the parser provides one, otherwise undefined.
 * Absent under oxlint's native parser and under plain ESLint without the TS parser.
 */
export function tryGetTypeChecker(
  services: ParserServices | undefined,
): ts.TypeChecker | undefined {
  if (!hasFullTypeInformation(services)) return undefined;
  return services.program.getTypeChecker();
}
