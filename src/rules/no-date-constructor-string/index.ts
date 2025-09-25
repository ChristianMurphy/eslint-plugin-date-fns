import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { isNewDateSyntax, isDateShadowed } from "../../utils/date-call.js";
import { createImportAndReplaceFix } from "../../utils/fixers.js";
import { getFirstArgument, getNodeRange } from "../../utils/types.js";
import { parseISO, isValid } from "date-fns";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [
  {
    formatPlaceholder?: string;
    refDateExpression?: string;
  },
];
type MessageIds =
  | "banNewDateString"
  | "banDateParse"
  | "suggestParse"
  | "suggestParseISO";

/**
 * Checks if node is a string literal.
 */
function isStringLiteral(
  nodeToCheck: TSESTree.Node,
): nodeToCheck is TSESTree.Literal & { value: string } {
  if (nodeToCheck.type !== "Literal") return false;
  return typeof nodeToCheck.value === "string";
}

/**
 * Checks if node is a template literal without expressions.
 */
function hasNoExpressionTemplateLiteral(
  nodeToCheck: TSESTree.Node,
): nodeToCheck is TSESTree.TemplateLiteral & { expressions: [] } {
  return (
    nodeToCheck.type === "TemplateLiteral" &&
    nodeToCheck.expressions.length === 0
  );
}

/**
 * Checks if node is a call expression with member expression pattern.
 */
function isCallExpressionWithMemberExpression(
  node: TSESTree.Node,
): node is TSESTree.CallExpression & {
  callee: TSESTree.MemberExpression & {
    property: TSESTree.Identifier;
    object: TSESTree.Identifier;
  };
} {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.object.type === "Identifier"
  );
}

/**
 * Extracts literal text from string literal or template literal nodes.
 */
export function literalText(node: TSESTree.Node): string | undefined {
  if (isStringLiteral(node)) {
    const raw = node.raw;
    return raw ?? JSON.stringify(node.value);
  }

  if (hasNoExpressionTemplateLiteral(node)) {
    const cooked = node.quasis[0]?.value?.cooked ?? "";
    return `\`${cooked}\``;
  }

  return undefined;
}

/**
 * Checks if identifier is declared as string type in same file.
 */
function sameFileDeclaredString(
  context: TSESLint.RuleContext<MessageIds, Options>,
  id: TSESTree.Identifier,
): boolean {
  const program = context.getSourceCode().ast;
  for (const stmt of program.body) {
    if (stmt.type !== "VariableDeclaration") continue;
    for (const decl of stmt.declarations) {
      if (decl.id.type !== "Identifier") continue;
      if (decl.id.name !== id.name) continue;

      // s: string
      if (decl.id.typeAnnotation?.type === "TSTypeAnnotation") {
        const typeAnnotation = decl.id.typeAnnotation.typeAnnotation;
        if (typeAnnotation.type === "TSStringKeyword") return true;
      }

      // s = 'literal' or s = `template`
      if (decl.init) {
        if (decl.init.type === "Literal" && typeof decl.init.value === "string")
          return true;
        if (
          decl.init.type === "TemplateLiteral" &&
          decl.init.expressions.length === 0
        )
          return true;
      }
    }
  }
  return false;
}

/**
 * Prevents dangerous string-based Date construction by enforcing date-fns alternatives.
 */
export default createRule<Options, MessageIds>({
  name: "no-date-constructor-string",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow string-based Date construction/parsing. Prefer date-fns parseISO/parse.",
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          formatPlaceholder: {
            type: "string",
            description:
              "Format placeholder for date-fns parse function suggestions",
          },
          refDateExpression: {
            type: "string",
            description:
              "Reference date expression for parse function suggestions",
          },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [
      { formatPlaceholder: "yyyy-MM-dd", refDateExpression: "new Date()" },
    ],
    messages: {
      banNewDateString:
        "Avoid new Date(string). Use date-fns `parseISO` or `parse`.",
      banDateParse:
        "Avoid Date.parse(string). Use date-fns `parseISO` or `parse`.",
      suggestParse: 'Use date-fns parse({{expr}}, "{{fmt}}", {{ref}}).',
      suggestParseISO: "Use date-fns parseISO({{expr}}).",
    },
  },
  defaultOptions: [
    { formatPlaceholder: "yyyy-MM-dd", refDateExpression: "new Date()" },
  ],
  create(context, [options]) {
    const sourceCode = context.getSourceCode();
    const checker =
      "parserServices" in context
        ? context.parserServices?.program?.getTypeChecker?.()
        : undefined;

    function isDateParseShadowed(node: TSESTree.CallExpression): boolean {
      if (node.callee.type !== "MemberExpression") return false;
      const object = node.callee.object;
      if (object.type !== "Identifier" || object.name !== "Date") return false;

      const sourceCode = context.getSourceCode();
      const scopeManager = sourceCode.scopeManager;
      if (scopeManager === null) return false;

      // Search through all scopes to find any that declare Date
      for (const scope of scopeManager.scopes) {
        const dateVariable = scope.variables.find(
          (variable) => variable.name === "Date",
        );
        if (
          dateVariable &&
          dateVariable.defs.length > 0 && // Check if this scope contains our node
          scope.block.range
        ) {
          const [scopeStart, scopeEnd] = scope.block.range;
          const [nodeStart, nodeEnd] = getNodeRange(node);

          if (nodeStart >= scopeStart && nodeEnd <= scopeEnd) {
            return true;
          }
        }
      }

      return false;
    }

    function isStringType(node: TSESTree.Node): boolean {
      try {
        // Best effort TS check for union types and complex expressions
        const tsNode = context.parserServices?.esTreeNodeToTSNodeMap?.get(node);
        if (tsNode && checker) {
          const typeAtLocation = checker.getTypeAtLocation(tsNode);
          const typeString = checker.typeToString(typeAtLocation);
          // Handle union types like string | number - flag if contains string
          if (typeString.includes("string")) return true;
        }
      } catch {
        // Type checking failed, continue with other checks
      }

      // Handle literal types
      if (node.type === "Literal" && typeof node.value === "string")
        return true;
      if (node.type === "TemplateLiteral" && node.expressions.length === 0)
        return true;

      // Handle binary expressions (e.g., '2024-' + '01-01')
      if (node.type === "BinaryExpression" && node.operator === "+") {
        return isStringType(node.left) || isStringType(node.right);
      }

      // Handle template literals with expressions
      if (node.type === "TemplateLiteral") return true;

      if (node.type === "Identifier")
        return sameFileDeclaredString(context, node);

      return false;
    }

    function tryIsoLiteralAutofix(argument: TSESTree.Node) {
      const raw = literalText(argument);
      if (!raw) return;
      // strip quotes to test
      const value =
        raw[0] === '"' || raw[0] === "'" || raw[0] === "`"
          ? raw.slice(1, -1)
          : raw;
      try {
        const d = parseISO(value);
        if (isValid(d)) {
          return (fixer: TSESLint.RuleFixer, node: TSESTree.Node) => {
            return createImportAndReplaceFix(
              context,
              fixer,
              ["parseISO"],
              node,
              `parseISO(${raw})`,
            );
          };
        }
      } catch {
        // not ISO
      }
    }

    function suggestParseAndParseISO(node: TSESTree.Node, exprText: string) {
      const fmt = options.formatPlaceholder ?? "yyyy-MM-dd";
      const reference = options.refDateExpression ?? "new Date()";
      context.report({
        node,
        messageId:
          node.type === "CallExpression" &&
          isCallExpressionWithMemberExpression(node) &&
          node.callee.property.name === "parse"
            ? "banDateParse"
            : "banNewDateString",
        suggest: [
          {
            messageId: "suggestParseISO",
            data: { expr: exprText },
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["parseISO"],
                node,
                `parseISO(${exprText})`,
              );
            },
          },
          {
            messageId: "suggestParse",
            data: { fmt, ref: reference, expr: exprText },
            fix(fixer) {
              return createImportAndReplaceFix(
                context,
                fixer,
                ["parse"],
                node,
                `parse(${exprText}, '${fmt}', ${reference})`,
              );
            },
          },
        ],
      });
    }

    function handleNode(
      node: TSESTree.NewExpression | TSESTree.CallExpression,
    ) {
      // Handle NewExpression (new Date(...))
      if (node.type === "NewExpression") {
        if (!isNewDateSyntax(node)) return;
        if (isDateShadowed(context, node)) return;

        if (node.arguments.length !== 1) return;
        const argument = getFirstArgument(node);
        if (!argument || !isStringType(argument)) return;

        processStringArgument(node, argument);
        return;
      }

      // Handle CallExpression (Date.parse(...))
      if (node.type === "CallExpression") {
        const isDateParse =
          isCallExpressionWithMemberExpression(node) &&
          node.callee.object.name === "Date" &&
          node.callee.property.name === "parse";

        if (!isDateParse) return;

        // Check if Date is shadowed for Date.parse calls
        if (isDateParseShadowed(node)) return;

        if (node.arguments.length !== 1) return;

        const argument = getFirstArgument(node);
        if (!argument || !isStringType(argument)) return;

        processStringArgument(node, argument);
      }
    }

    function processStringArgument(
      node: TSESTree.NewExpression | TSESTree.CallExpression,
      argument: TSESTree.Node,
    ) {
      // Handle string literal: try ISO autofix
      const literalFix = tryIsoLiteralAutofix(argument);
      if (literalFix) {
        const isDateParse =
          node.type === "CallExpression" &&
          isCallExpressionWithMemberExpression(node) &&
          node.callee.property.name === "parse";

        context.report({
          node,
          messageId: isDateParse ? "banDateParse" : "banNewDateString",
          fix(fixer) {
            return literalFix(fixer, node);
          },
        });
        return;
      }

      // Otherwise: suggestions (parseISO + parse)
      const exprText = sourceCode.getText(argument);
      suggestParseAndParseISO(node, exprText);
    }

    return {
      NewExpression: handleNode,
      CallExpression: handleNode,
    };
  },
});
