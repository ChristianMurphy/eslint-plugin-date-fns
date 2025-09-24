import { ESLintUtils } from "@typescript-eslint/utils";
import { createImportAndReplaceFix } from "../../utils/fixers.js";
import { isBareGlobalDateCall } from "../../utils/date-call.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "noBareDate" | "suggestFormat";

/**
 * Prevents bare Date() calls that return strings instead of Date objects.
 */
export default createRule<Options, MessageIds>({
  name: "no-bare-date-call",
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow calling Date() without new. Prefer format(new Date(), "...").',
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      noBareDate:
        'Calling Date() returns a string; prefer using date-fns format(new Date(), "...").',
      suggestFormat:
        'Use format(new Date(), "yyyy-MM-dd") (adjust format to your needs).',
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (!isBareGlobalDateCall(context, node)) return;

        context.report({
          node,
          messageId: "noBareDate",
          suggest: [
            {
              messageId: "suggestFormat",
              fix(fixer) {
                return createImportAndReplaceFix(
                  context,
                  fixer,
                  ["format"],
                  node,
                  `format(new Date(), 'yyyy-MM-dd')`,
                );
              },
            },
          ],
        });
      },
    };
  },
});
