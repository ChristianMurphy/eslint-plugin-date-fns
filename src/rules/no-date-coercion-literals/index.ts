import { ESLintUtils } from "@typescript-eslint/utils";
import { createImportAndReplaceFix } from "../../utils/fixers.js";
import { isGlobalThisDateCall, isLiteral } from "../../utils/expressions.js";
import { getFirstArgument } from "../../utils/types.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "noNull" | "noTrue" | "noFalse";

/**
 * Prevents Date constructor coercion of boolean and null literals.
 */
export default createRule<Options, MessageIds>({
  name: "no-date-coercion-literals",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Date coercions like new Date(null/true). Prefer explicit parseISO UTC literals.",
    },
    fixable: "code",
    schema: [],
    messages: {
      noNull: 'Avoid new Date(null). Use parseISO("1970-01-01T00:00:00Z").',
      noTrue: 'Avoid new Date(true). Use parseISO("1970-01-01T00:00:00.001Z").',
      noFalse: 'Avoid new Date(false). Use parseISO("1970-01-01T00:00:00Z").',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        const isDateCtor =
          (node.callee.type === "Identifier" && node.callee.name === "Date") ||
          isGlobalThisDateCall(node.callee);
        if (!isDateCtor || node.arguments.length !== 1) return;

        const argument = getFirstArgument(node);
        if (!argument) return;
        if (isLiteral(argument) && argument.value === null) {
          context.report({
            node,
            messageId: "noNull",
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["parseISO"],
                node,
                `parseISO('1970-01-01T00:00:00Z')`,
              );
            },
          });
          return;
        }
        if (isLiteral(argument) && argument.value === true) {
          context.report({
            node,
            messageId: "noTrue",
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["parseISO"],
                node,
                `parseISO('1970-01-01T00:00:00.001Z')`,
              );
            },
          });
          return;
        }
        if (isLiteral(argument) && argument.value === false) {
          context.report({
            node,
            messageId: "noFalse",
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["parseISO"],
                node,
                `parseISO('1970-01-01T00:00:00Z')`,
              );
            },
          });
        }
      },
    };
  },
});
