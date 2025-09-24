import {
  ESLintUtils,
  TSESTree,
  type ParserServices,
  type ParserServicesWithTypeInformation,
} from "@typescript-eslint/utils";
import * as ts from "typescript";
import { isTypeNumberish } from "../../utils/types.js";
import { isNewDateSyntax, isDateShadowed } from "../../utils/date-call.js";
import {
  getSingleExpressionArgument,
  isIdentifier,
} from "../../utils/expressions.js";
import { createImportAndReplaceFix } from "../../utils/fixers.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds =
  | "preferToDate"
  | "preferFromUnixTime"
  | "suggestToDate"
  | "suggestFromUnixTime";

/**
 * Checks if parser services include full TypeScript type information.
 */
function hasFullTypeInformation(
  services: ParserServices,
): services is ParserServicesWithTypeInformation {
  return (
    "program" in services &&
    services.program !== null &&
    "getTypeAtLocation" in services &&
    "getSymbolAtLocation" in services
  );
}

/**
 * Checks if absolute value represents 10-digit Unix seconds.
 */
function isTenDigitSeconds(absValue: number): boolean {
  return absValue >= 1_000_000_000 && absValue < 10_000_000_000;
}

/**
 * Classifies numeric literal as seconds or milliseconds for fix generation.
 */
function classifyLiteralForFix(
  numberValue: number,
): { kind: "seconds"; negative: boolean } | { kind: "milliseconds" } {
  const negative = numberValue < 0;
  const absoluteValue = Math.abs(numberValue);
  if (isTenDigitSeconds(absoluteValue)) {
    return { kind: "seconds", negative };
  }
  return { kind: "milliseconds" };
}

/**
 * If the identifier is declared in the same file with a numeric literal initializer,
 * return that number (handles unary minus and `as const` on numeric literal).
 * No constant folding beyond that.
 */
export function sameFileNumberInitializerValue(
  program: TSESTree.Program,
  id: TSESTree.Identifier,
): number | undefined {
  for (const stmt of program.body) {
    if (stmt.type !== "VariableDeclaration") continue;

    for (const decl of stmt.declarations) {
      if (decl.id.type !== "Identifier" || decl.id.name !== id.name) continue;
      const init = decl.init;
      if (!init) continue;

      if (init.type === "Literal" && typeof init.value === "number") {
        return init.value;
      }
      if (
        init.type === "UnaryExpression" &&
        init.operator === "-" &&
        init.argument.type === "Literal" &&
        typeof init.argument.value === "number"
      ) {
        return -init.argument.value;
      }
      if (
        init.type === "TSAsExpression" &&
        init.expression.type === "Literal" &&
        typeof init.expression.value === "number"
      ) {
        return init.expression.value;
      }
    }
  }
  return undefined;
}

/**
 * Enforces date-fns functions for epoch timestamp conversion instead of Date constructor.
 */
export default createRule<Options, MessageIds>({
  name: "prefer-date-fns-from-epoch",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer date-fns toDate(ms) or fromUnixTime(sec) over new Date(number).",
    },
    hasSuggestions: true,
    fixable: "code",
    schema: [],
    messages: {
      preferToDate:
        "Prefer date-fns toDate(milliseconds) over new Date(milliseconds).",
      preferFromUnixTime:
        "Prefer date-fns fromUnixTime(seconds) over new Date(seconds).",
      suggestToDate: "Use toDate({{expr}}).",
      suggestFromUnixTime: "Use fromUnixTime({{expr}}) if value is seconds.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context, true);
    if (!hasFullTypeInformation(services)) {
      // No type info (shouldn't happen with the `true` flag, but keeps TS happy)
      return {};
    }

    const checker = services.program.getTypeChecker();
    const source = context.getSourceCode();
    const program = source.ast;

    /** TS semantic number-ish check, with literal/annotation fallbacks */
    function isNumberish(node: TSESTree.Expression): boolean {
      // Check literal numbers first (this should catch numeric literals)
      if (node.type === "Literal" && typeof node.value === "number") {
        return true;
      }

      // Try TypeScript semantic analysis
      const tsNode = services.esTreeNodeToTSNodeMap.get(node);
      if (ts.isExpression(tsNode)) {
        const typeAtLocation = checker.getTypeAtLocation(tsNode);
        if (isTypeNumberish(typeAtLocation)) return true;
      }

      if (isIdentifier(node)) {
        for (const stmt of program.body) {
          if (stmt.type !== "VariableDeclaration") continue;
          for (const decl of stmt.declarations) {
            if (decl.id.type !== "Identifier" || decl.id.name !== node.name)
              continue;

            const annotation =
              decl.id.typeAnnotation?.type === "TSTypeAnnotation"
                ? decl.id.typeAnnotation.typeAnnotation
                : undefined;
            if (annotation?.type === "TSNumberKeyword") return true;

            if (sameFileNumberInitializerValue(program, node) !== undefined) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function reportSuggestions(node: TSESTree.NewExpression, expr: string) {
      context.report({
        node,
        messageId: "preferToDate",
        suggest: [
          {
            messageId: "suggestToDate",
            data: { expr },
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["toDate"],
                node,
                `toDate(${expr})`,
              );
            },
          },
          {
            messageId: "suggestFromUnixTime",
            data: { expr },
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["fromUnixTime"],
                node,
                `fromUnixTime(${expr})`,
              );
            },
          },
        ],
      });
    }

    return {
      NewExpression(node) {
        if (!isNewDateSyntax(node)) return;
        if (isDateShadowed(context, node)) {
          return;
        }

        const argument = getSingleExpressionArgument(node);
        if (!argument) return;

        if (!isNumberish(argument)) return;

        if (argument.type === "Literal" && typeof argument.value === "number") {
          const numberValue = argument.value;
          const classification = classifyLiteralForFix(numberValue);

          if (classification.kind === "seconds") {
            if (classification.negative) {
              reportSuggestions(node, String(numberValue));
              return;
            }
            context.report({
              node,
              messageId: "preferFromUnixTime",
              fix(fixer) {
                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["fromUnixTime"],
                  node,
                  `fromUnixTime(${String(numberValue)})`,
                );
              },
            });
            return;
          }

          context.report({
            node,
            messageId: "preferToDate",
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["toDate"],
                node,
                `toDate(${String(numberValue)})`,
              );
            },
          });
          return;
        }

        if (isIdentifier(argument)) {
          const initValue = sameFileNumberInitializerValue(program, argument);
          if (initValue !== undefined) {
            const expression = source.getText(argument);
            const classification = classifyLiteralForFix(initValue);

            if (classification.kind === "seconds") {
              if (classification.negative) {
                reportSuggestions(node, expression);
                return;
              }
              context.report({
                node,
                messageId: "preferFromUnixTime",
                fix(fixer) {
                  return createImportAndReplaceFix(
                    context,
                    fixer,
                    ["fromUnixTime"],
                    node,
                    `fromUnixTime(${expression})`,
                  );
                },
              });
              return;
            }

            context.report({
              node,
              messageId: "preferToDate",
              fix(fixer) {
                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["toDate"],
                  node,
                  `toDate(${expression})`,
                );
              },
            });
            return;
          }
        }

        reportSuggestions(node, source.getText(argument));
      },
    };
  },
});
