import {
  AST_NODE_TYPES,
  ESLintUtils,
  type TSESTree,
} from "@typescript-eslint/utils";
import { ensureDateFnsNamedImport } from "../../utils/imports.js";
import { tryGetParserServices } from "../../utils/type-services.js";
import {
  collectImportedDateReturners,
  isDateTyped,
  isObviouslyDateExpression,
} from "../../utils/date-call.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "preferDifference";

/**
 * Millisecond divisors and the date-fns function that replaces them.
 *
 * Weeks and years are intentionally omitted: date-fns computes
 * `differenceInWeeks` / `differenceInYears` calendar-aware, so rewriting
 * `(b - a) / 604_800_000` would silently change semantics around DST and
 * leap-year boundaries.
 */
const UNIT_BY_MILLISECONDS: ReadonlyMap<number, string> = new Map([
  [86_400_000, "differenceInDays"],
  [3_600_000, "differenceInHours"],
  [60_000, "differenceInMinutes"],
  [1000, "differenceInSeconds"],
]);

/**
 * Statically evaluates a purely numeric literal expression tree, so
 * `1000 * 60 * 60 * 24` is recognized as 86_400_000 without triggering on
 * runtime values. Returns undefined for anything non-literal.
 */
function evaluateLiteralNumber(node: TSESTree.Node): number | undefined {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "number") {
    return node.value;
  }
  if (node.type === AST_NODE_TYPES.BinaryExpression) {
    const left = evaluateLiteralNumber(node.left);
    const right = evaluateLiteralNumber(node.right);
    if (left === undefined || right === undefined) return undefined;
    switch (node.operator) {
      case "*": {
        return left * right;
      }
      case "+": {
        return left + right;
      }
      case "-": {
        return left - right;
      }
      case "/": {
        return right === 0 ? undefined : left / right;
      }
      default: {
        return undefined;
      }
    }
  }
  return undefined;
}

export default createRule<Options, MessageIds>({
  name: "prefer-difference-in-unit",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer date-fns differenceIn* helpers over manual Date-subtraction arithmetic.",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferDifference:
        "Prefer {{ helper }} from date-fns over manual Date subtraction.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = tryGetParserServices(context);
    const sourceCode = context.sourceCode;
    const importedDateReturners = collectImportedDateReturners(sourceCode.ast);

    function bothDate(
      left: TSESTree.Expression,
      right: TSESTree.Expression,
    ): boolean {
      const obvious =
        isObviouslyDateExpression(left, importedDateReturners) &&
        isObviouslyDateExpression(right, importedDateReturners);
      if (obvious) return true;
      return isDateTyped(left, services) && isDateTyped(right, services);
    }

    return {
      BinaryExpression(node) {
        if (node.operator !== "/") return;
        const divisor = evaluateLiteralNumber(node.right);
        if (divisor === undefined) return;
        const helper = UNIT_BY_MILLISECONDS.get(divisor);
        if (helper === undefined) return;

        // TSESTree flattens grouping expressions, so `(b - a)` shows up as
        // a plain BinaryExpression here.
        const dividend = node.left;
        if (dividend.type !== AST_NODE_TYPES.BinaryExpression) return;
        if (dividend.operator !== "-") return;

        if (!bothDate(dividend.left, dividend.right)) return;

        const leftText = sourceCode.getText(dividend.left);
        const rightText = sourceCode.getText(dividend.right);

        context.report({
          node,
          messageId: "preferDifference",
          data: { helper },
          fix: (fixer) => {
            const { fix: importFix, localBinding } = ensureDateFnsNamedImport(
              context,
              fixer,
              helper,
            );
            const replacement = `${localBinding}(${leftText}, ${rightText})`;
            const fixes = [fixer.replaceText(node, replacement)];
            if (importFix) fixes.unshift(importFix);
            return fixes;
          },
        });
      },
    };
  },
});
