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
type MessageIds = "dateInInterpolation" | "suggestFormat";

/**
 * Matches `x.toString()` called with zero args on a dot-accessed property.
 */
function isZeroArgumentToStringCall(
  node: TSESTree.Expression,
): node is TSESTree.CallExpression & { callee: TSESTree.MemberExpression } {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  if (node.arguments.length > 0) return false;
  const { callee } = node;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (callee.computed) return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "toString";
}

/**
 * Flags Date expressions embedded in string templates via implicit
 * coercion, which uses `Date.prototype.toString` and produces a
 * locale-dependent string.
 */
export default createRule<Options, MessageIds>({
  name: "no-date-in-string-interpolation",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow implicit Date-to-string coercion inside template literals.",
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      dateInInterpolation:
        "Date inside template literal uses locale-dependent coercion; format it explicitly with date-fns.",
      suggestFormat:
        "Wrap with format(expr, 'yyyy-MM-dd') (adjust pattern to suit).",
    },
  },
  defaultOptions: [],
  create(context) {
    const services = tryGetParserServices(context);
    const sourceCode = context.sourceCode;
    const importedDateReturners = collectImportedDateReturners(sourceCode.ast);

    function isDateExpression(node: TSESTree.Expression): boolean {
      if (isObviouslyDateExpression(node, importedDateReturners)) return true;
      if (isDateTyped(node, services)) return true;
      return false;
    }

    function isDateToStringCoercion(node: TSESTree.Expression): boolean {
      if (!isZeroArgumentToStringCall(node)) return false;
      return isDateExpression(node.callee.object as TSESTree.Expression);
    }

    function reportDateInStringContext(target: TSESTree.Expression): boolean {
      const targetIsDate = isDateExpression(target);
      const targetIsDateToString = isDateToStringCoercion(target);
      if (!targetIsDate && !targetIsDateToString) return false;

      context.report({
        node: target,
        messageId: "dateInInterpolation",
        suggest: [
          {
            messageId: "suggestFormat",
            fix(fixer) {
              const { fix: importFix, localBinding } = ensureDateFnsNamedImport(
                context,
                fixer,
                "format",
              );
              const wrapOn =
                targetIsDateToString && isZeroArgumentToStringCall(target)
                  ? (target.callee.object as TSESTree.Expression)
                  : target;
              const wrapText = sourceCode.getText(wrapOn);
              const replacement = `${localBinding}(${wrapText}, 'yyyy-MM-dd')`;
              const fixes = [fixer.replaceText(target, replacement)];
              if (importFix) fixes.unshift(importFix);
              return fixes;
            },
          },
        ],
      });
      return true;
    }

    return {
      TemplateLiteral(node) {
        if (node.parent.type === AST_NODE_TYPES.TaggedTemplateExpression) {
          return;
        }
        for (const expr of node.expressions) {
          void reportDateInStringContext(expr);
        }
      },
      // String concatenation: `+` with at least one Date operand always
      // routes through `Date.prototype.toString` because the JS `+`
      // operator hint for Date is "default", which Date resolves as a
      // string. Covers "text " + date, date + "text", and date + date.
      // Both sides are checked independently, but we emit at most one
      // report per BinaryExpression to avoid double-diagnosing `a + b`
      // where both operands are Date.
      'BinaryExpression[operator="+"]'(node: TSESTree.BinaryExpression) {
        if (node.left.type === AST_NODE_TYPES.PrivateIdentifier) return;
        if (!reportDateInStringContext(node.left)) {
          reportDateInStringContext(node.right);
        }
      },
      // `s += date` is the same footgun as `s + date`. The left side of
      // `+=` is always the assignment target, so we only check the right.
      'AssignmentExpression[operator="+="]'(
        node: TSESTree.AssignmentExpression,
      ) {
        reportDateInStringContext(node.right);
      },
    };
  },
});
