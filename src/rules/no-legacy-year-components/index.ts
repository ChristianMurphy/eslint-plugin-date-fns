import { ESLintUtils } from "@typescript-eslint/utils";
import { createImportAndReplaceFix } from "../../utils/fixers.js";
import { isGlobalThisDateCall } from "../../utils/expressions.js";
import { isDateShadowed } from "../../utils/date-call.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "noLegacyYear" | "suggestParseIso";

/**
 * Prevents ambiguous Date constructor usage with legacy year values (0-99).
 */
export default createRule<Options, MessageIds>({
  name: "no-legacy-year-components",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow new Date(y, ...) with 0 ≤ y ≤ 99 (maps to 1900+y). Prefer explicit ISO literal via parseISO.",
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      noLegacyYear:
        "Avoid new Date(y, ... ) with y in 0..99 (coerced to 1900+y). Use an explicit four-digit year.",
      suggestParseIso:
        'Use parseISO("{{iso}}") with an explicit four-digit year.',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        const isDateCtor =
          (node.callee.type === "Identifier" && node.callee.name === "Date") ||
          isGlobalThisDateCall(node.callee);
        if (!isDateCtor) return;

        // Check for Date shadowing - if Date is shadowed, this is not the global Date
        if (
          node.callee.type === "Identifier" &&
          isDateShadowed(context, node)
        ) {
          return;
        }

        if (node.arguments.length < 2) return;

        const yearArgument = node.arguments[0];
        const monthArgument = node.arguments[1];
        if (
          yearArgument?.type === "Literal" &&
          typeof yearArgument.value === "number" &&
          yearArgument.value >= 0 &&
          yearArgument.value <= 99
        ) {
          const month =
            monthArgument?.type === "Literal" &&
            typeof monthArgument.value === "number"
              ? String(monthArgument.value + 1).padStart(2, "0")
              : "MM";
          const iso = `${String(yearArgument.value).padStart(4, "0")}-${month}-01T00:00:00.000Z`;
          context.report({
            node,
            messageId: "noLegacyYear",
            suggest: [
              {
                messageId: "suggestParseIso",
                data: { iso },
                fix(fixer) {
                  return createImportAndReplaceFix(
                    context,
                    fixer,
                    ["parseISO"],
                    node,
                    `parseISO('${iso}')`,
                  );
                },
              },
            ],
          });
        }
      },
    };
  },
});
