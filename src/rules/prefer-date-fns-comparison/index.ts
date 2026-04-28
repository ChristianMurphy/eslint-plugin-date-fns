import {
  AST_NODE_TYPES,
  ASTUtils,
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
type MessageIds = "preferIsEqual" | "suggestIsEqual";

const EQUALITY_OPERATORS = new Set(["===", "!==", "==", "!="]);
const TIMESTAMP_METHODS = new Set(["getTime", "valueOf"]);

function isTimestampCall(
  node: TSESTree.Node,
): node is TSESTree.CallExpression & { callee: TSESTree.MemberExpression } {
  if (!ASTUtils.isNodeOfType(AST_NODE_TYPES.CallExpression)(node)) return false;
  if (node.arguments.length > 0) return false;
  const { callee } = node;
  if (!ASTUtils.isNodeOfType(AST_NODE_TYPES.MemberExpression)(callee)) {
    return false;
  }
  if (callee.computed) return false;
  const { property } = callee;
  if (!ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(property)) return false;
  return TIMESTAMP_METHODS.has(property.name);
}

function buildCallText(
  leftText: string,
  rightText: string,
  isNegated: boolean,
  localBinding: string,
): string {
  const call = `${localBinding}(${leftText}, ${rightText})`;
  return isNegated ? `!${call}` : call;
}

/**
 * Flags equality comparisons between two Dates and prefers date-fns
 * `isEqual`. The `.getTime()` / `.valueOf()` pattern has a full autofix
 * because the rewrite is unambiguous. For bare Date comparisons
 * (`a === b`), the rule degrades to a suggestion because the author may
 * have intended reference equality or a day-bucket comparison.
 */
export default createRule<Options, MessageIds>({
  name: "prefer-date-fns-comparison",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer date-fns isEqual over equality operators on Date objects.",
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [],
    messages: {
      preferIsEqual:
        "Comparing Dates with {{ operator }} is unsafe; use isEqual from date-fns.",
      suggestIsEqual: "Replace with isEqual(left, right) from date-fns.",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = tryGetParserServices(context);
    const sourceCode = context.sourceCode;
    const importedDateReturners = collectImportedDateReturners(sourceCode.ast);

    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return;
        // `in` / `instanceof` exclusion also discards PrivateIdentifier-left
        // shapes such as `#foo in obj`, leaving two Expression operands.
        if (node.left.type === AST_NODE_TYPES.PrivateIdentifier) return;
        const isNegated = node.operator === "!==" || node.operator === "!=";

        if (isTimestampCall(node.left) && isTimestampCall(node.right)) {
          const leftReceiver = sourceCode.getText(node.left.callee.object);
          const rightReceiver = sourceCode.getText(node.right.callee.object);

          context.report({
            node,
            messageId: "preferIsEqual",
            data: { operator: node.operator },
            fix: (fixer) => {
              const { fix: importFix, localBinding } = ensureDateFnsNamedImport(
                context,
                fixer,
                "isEqual",
              );
              const replacement = buildCallText(
                leftReceiver,
                rightReceiver,
                isNegated,
                localBinding,
              );
              const fixes = [fixer.replaceText(node, replacement)];
              if (importFix) fixes.unshift(importFix);
              return fixes;
            },
          });
          return;
        }

        const bothObviouslyDate =
          isObviouslyDateExpression(node.left, importedDateReturners) &&
          isObviouslyDateExpression(node.right, importedDateReturners);
        const bothDateTyped =
          isDateTyped(node.left, services) && isDateTyped(node.right, services);
        if (!bothObviouslyDate && !bothDateTyped) return;

        const leftText = sourceCode.getText(node.left);
        const rightText = sourceCode.getText(node.right);

        context.report({
          node,
          messageId: "preferIsEqual",
          data: { operator: node.operator },
          suggest: [
            {
              messageId: "suggestIsEqual",
              fix: (fixer) => {
                const { fix: importFix, localBinding } =
                  ensureDateFnsNamedImport(context, fixer, "isEqual");
                const replacement = buildCallText(
                  leftText,
                  rightText,
                  isNegated,
                  localBinding,
                );
                const fixes = [fixer.replaceText(node, replacement)];
                if (importFix) fixes.unshift(importFix);
                return fixes;
              },
            },
          ],
        });
      },
    };
  },
});
