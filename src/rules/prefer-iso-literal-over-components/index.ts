import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { createImportAndReplaceFix } from "../../utils/fixers.js";
import { synthesizeUtcIso } from "../../utils/iso.js";
import { isNewDateSyntax, isDateShadowed } from "../../utils/date-call.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "preferIso" | "suggestIso";

/**
 * Extracts numeric values from array if all arguments are numeric literals.
 */
function allNumericLiterals(
  argumentsArray: TSESTree.Node[],
): number[] | undefined {
  const outputValues: number[] = [];
  for (const argument of argumentsArray) {
    if (argument.type === "Literal" && typeof argument.value === "number") {
      outputValues.push(argument.value);
    } else {
      return undefined;
    }
  }
  return outputValues;
}

/**
 * Replaces multi-argument Date constructor with ISO literal via parseISO when all arguments are numeric literals.
 */
export default createRule<Options, MessageIds>({
  name: "prefer-iso-literal-over-components",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer an ISO literal (UTC) via parseISO over Date component constructor when literals are used.",
    },
    hasSuggestions: true,
    fixable: "code",
    schema: [],
    messages: {
      preferIso:
        'Prefer date-fns parseISO("YYYY-MM-DDTHH:mm:ss.SSSZ") over Date component constructor.',
      suggestIso: 'Use parseISO("{{iso}}") (UTC).',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      NewExpression(node) {
        if (!isNewDateSyntax(node)) return;
        if (isDateShadowed(context, node)) return; // Skip shadowed Date
        if (node.arguments.length < 2) return; // handled by other rules

        const numericValues = allNumericLiterals(node.arguments);
        if (numericValues) {
          const [year, month, day, hour, minute, second, millisecond] =
            numericValues;
          if (year === undefined || month === undefined) return;
          const iso = synthesizeUtcIso(
            year,
            month,
            day,
            hour,
            minute,
            second,
            millisecond,
          );
          context.report({
            node,
            messageId: "preferIso",
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["parseISO"],
                node,
                `parseISO('${iso}')`,
              );
            },
          });
          return;
        }

        // Mixed args → suggestion
        // Try to grab any literal values we can; for display, use placeholders
        const argumentValues = node.arguments.map((argument, index) =>
          argument.type === "Literal" && typeof argument.value === "number"
            ? String(argument.value)
            : `arg${index}`,
        );
        const yearValue = Number(argumentValues[0] ?? "yyyy");
        const monthValue = Number(argumentValues[1] ?? "m");
        const isoExample =
          Number.isFinite(yearValue) && Number.isFinite(monthValue)
            ? synthesizeUtcIso(
                Number(argumentValues[0]),
                Number(argumentValues[1]),
              )
            : "YYYY-MM-DDT00:00:00.000Z";

        context.report({
          node,
          messageId: "preferIso",
          suggest: [
            {
              messageId: "suggestIso",
              data: { iso: isoExample },
              fix(fixer) {
                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["parseISO"],
                  node,
                  `parseISO('${isoExample}')`,
                );
              },
            },
          ],
        });
      },
    };
  },
});
