import { ESLintUtils, TSESTree, ASTUtils } from "@typescript-eslint/utils";
import type { TSESLint } from "@typescript-eslint/utils";
import { parseISO, parse, isValid } from "date-fns";
import { ensureDateFnsNamedImports } from "../../utils/imports.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "requireIsValid" | "suggestGuard" | "invalidConstantString";

/**
 * Checks if callee is an identifier with given name.
 */
function isIdentifierCallee(
  callee: TSESTree.Expression,
  name: string,
): callee is TSESTree.Identifier {
  return callee.type === "Identifier" && callee.name === name;
}

/**
 * Checks if node is a call to parse or parseISO function.
 */
function isParseCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  if (node.type !== "CallExpression") return false;
  return (
    isIdentifierCallee(node.callee, "parse") ||
    isIdentifierCallee(node.callee, "parseISO")
  );
}

/**
 * Checks if node is a call to isValid function with specific identifier.
 */
function isIsValidCall(
  node: TSESTree.CallExpression,
  identifierName: string,
  getText: (nodeToCheck: TSESTree.Node) => string,
): boolean {
  if (!isIdentifierCallee(node.callee, "isValid")) return false;
  const firstArgument = node.arguments[0];
  return (
    firstArgument !== undefined && getText(firstArgument) === identifierName
  );
}

/**
 * Validates a constant string with parseISO and returns the validation result.
 */
function validateConstantParseISO(dateString: string): boolean {
  try {
    const parsedDate = parseISO(dateString);
    return isValid(parsedDate);
  } catch {
    return false;
  }
}

/**
 * Validates a constant string with parse and returns the validation result.
 */
function validateConstantParse(
  dateString: string,
  formatString: string,
): boolean {
  try {
    const parsedDate = parse(dateString, formatString, new Date());
    return isValid(parsedDate);
  } catch {
    return false;
  }
}

/**
 * Attempts to statically evaluate a parse call to determine if the result would be valid.
 * Returns true if valid, false if invalid, undefined if cannot be statically evaluated.
 */
function tryStaticEvaluateParseCall(
  callNode: TSESTree.CallExpression,
  scope: TSESLint.Scope.Scope,
): boolean | undefined {
  // Handle parseISO(stringArg)
  if (
    isIdentifierCallee(callNode.callee, "parseISO") &&
    callNode.arguments.length > 0
  ) {
    const dateStringArgument = callNode.arguments[0];
    if (!dateStringArgument) return undefined;

    const dateString = ASTUtils.getStringIfConstant(dateStringArgument, scope);
    if (dateString === null) return undefined;

    return validateConstantParseISO(dateString);
  }

  // Handle parse(stringArg, formatArg, referenceDate)
  if (
    isIdentifierCallee(callNode.callee, "parse") &&
    callNode.arguments.length >= 2
  ) {
    const dateStringArgument = callNode.arguments[0];
    const formatArgument = callNode.arguments[1];
    if (!dateStringArgument || !formatArgument) return undefined;

    const dateString = ASTUtils.getStringIfConstant(dateStringArgument, scope);
    const formatString = ASTUtils.getStringIfConstant(formatArgument, scope);

    if (dateString === null || formatString === null) {
      return undefined;
    }

    return validateConstantParse(dateString, formatString);
  }

  return undefined;
}

/** Recursively search for isValid(identifierName) calls in any expression */
function hasIsValidCall(
  node: TSESTree.Node,
  identifierName: string,
  getText: (nodeToCheck: TSESTree.Node) => string,
): boolean {
  // Direct isValid call
  if (
    node.type === "CallExpression" &&
    isIsValidCall(node, identifierName, getText)
  ) {
    return true;
  }

  // Search in child nodes
  switch (node.type) {
    case "ConditionalExpression": {
      return (
        hasIsValidCall(node.test, identifierName, getText) ||
        hasIsValidCall(node.consequent, identifierName, getText) ||
        hasIsValidCall(node.alternate, identifierName, getText)
      );
    }
    case "LogicalExpression":
    case "BinaryExpression": {
      return (
        hasIsValidCall(node.left, identifierName, getText) ||
        hasIsValidCall(node.right, identifierName, getText)
      );
    }
    case "UnaryExpression": {
      return hasIsValidCall(node.argument, identifierName, getText);
    }
    case "MemberExpression": {
      // Check for Chai-style .to.be.false - this does NOT count as validation
      if (
        node.property.type === "Identifier" &&
        node.property.name === "false"
      ) {
        return false;
      }
      return hasIsValidCall(node.object, identifierName, getText);
    }
    case "CallExpression": {
      // Check for false assertions like expect(isValid(d)).toBe(false) - these don't count as validation
      if (
        node.callee.type === "MemberExpression" &&
        node.callee.property.type === "Identifier"
      ) {
        const methodName = node.callee.property.name;
        // toBeFalsy() - not a validation
        if (methodName === "toBeFalsy") {
          return false;
        }
        // toBe(false), toEqual(false), toStrictEqual(false) - not a validation
        if (
          (methodName === "toBe" ||
            methodName === "toEqual" ||
            methodName === "toStrictEqual") &&
          node.arguments.length > 0 &&
          node.arguments[0]?.type === "Literal" &&
          node.arguments[0].value === false
        ) {
          return false;
        }
      }
      // Check callee (for chained calls like expect(...).toBe(...))
      if (hasIsValidCall(node.callee, identifierName, getText)) {
        return true;
      }
      return node.arguments.some((argument) =>
        hasIsValidCall(argument, identifierName, getText),
      );
    }
    case "ReturnStatement": {
      return node.argument
        ? hasIsValidCall(node.argument, identifierName, getText)
        : false;
    }
    case "VariableDeclarator": {
      return node.init
        ? hasIsValidCall(node.init, identifierName, getText)
        : false;
    }
    case "VariableDeclaration": {
      return node.declarations.some((declarator) =>
        hasIsValidCall(declarator, identifierName, getText),
      );
    }
    case "AssignmentExpression": {
      return hasIsValidCall(node.right, identifierName, getText);
    }
    case "IfStatement": {
      return (
        hasIsValidCall(node.test, identifierName, getText) ||
        hasIsValidCall(node.consequent, identifierName, getText) ||
        (node.alternate
          ? hasIsValidCall(node.alternate, identifierName, getText)
          : false)
      );
    }
    case "ExpressionStatement": {
      return hasIsValidCall(node.expression, identifierName, getText);
    }
    case "BlockStatement": {
      return node.body.some((statement) =>
        hasIsValidCall(statement, identifierName, getText),
      );
    }
    default: {
      return false;
    }
  }
}

/** Return the statement list for a Program or BlockStatement */
function getStatements(
  block: TSESTree.Program | TSESTree.BlockStatement,
): TSESTree.Statement[] {
  return block.body;
}

/** Cheap textual usage check (heuristic) */
function statementUsesIdentifier(
  statement: TSESTree.Statement,
  identifierName: string,
  getText: (nodeToCheck: TSESTree.Node) => string,
): boolean {
  const statementText = getText(statement);
  return statementText.includes(identifierName);
}

/**
 * Enforces isValid checks after date-fns parse functions to prevent invalid date usage.
 */
export default createRule<Options, MessageIds>({
  name: "require-isvalid-after-parse",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require isValid(x) checks after parse()/parseISO() before using the Date value.",
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      requireIsValid:
        "Result of parse/parseISO should be validated with isValid(...) before use.",
      suggestGuard:
        "Add a guard: const {{id}} = {{call}}; if (!isValid({{id}})) { /* handle invalid */ }",
      invalidConstantString:
        "Constant string passed to parse/parseISO is invalid and will always produce an invalid Date.",
    },
  },
  defaultOptions: [],
  create(context) {
    const source = context.getSourceCode();

    function checkDeclarator(declarator: TSESTree.VariableDeclarator): void {
      // Must be: const <id> = parse(...) / parseISO(...)
      if (declarator.id.type !== "Identifier") return;
      if (!declarator.init || !isParseCall(declarator.init)) return;

      const identifierName = declarator.id.name;

      // Check if we can statically evaluate the parse call
      const scope = source.getScope(declarator);
      const staticResult = tryStaticEvaluateParseCall(declarator.init, scope);

      if (staticResult !== undefined) {
        // We have a constant string - check if it's valid
        if (!staticResult) {
          // Invalid constant string - flag with no fix
          context.report({
            node: declarator,
            messageId: "invalidConstantString",
          });
        }
        // If valid constant string, don't flag at all
        return;
      }

      // Dynamic string - continue with existing logic

      // Declarator must be inside a VariableDeclaration
      const parentDeclaration = declarator.parent;
      if (
        !parentDeclaration ||
        parentDeclaration.type !== "VariableDeclaration"
      ) {
        return;
      }

      // Parent's parent should be a Program or BlockStatement
      const container = parentDeclaration.parent;
      if (!container) return;
      if (container.type !== "Program" && container.type !== "BlockStatement") {
        return;
      }

      // Find the declaration in the container body
      const statements = getStatements(container);
      const startIndex = statements.indexOf(parentDeclaration);
      if (startIndex === -1) return; // safety

      let hasGuard = false;
      let usedBeforeGuard = false;

      // Inspect subsequent sibling statements in the same block
      for (const statement of statements.slice(startIndex + 1)) {
        // Check if statement contains isValid validation
        if (
          hasIsValidCall(statement, identifierName, source.getText.bind(source))
        ) {
          hasGuard = true;
          break;
        }

        // Any usage of the identifier before a guard?
        if (
          statementUsesIdentifier(
            statement,
            identifierName,
            source.getText.bind(source),
          )
        ) {
          usedBeforeGuard = true;
          break;
        }
      }

      if (!hasGuard && usedBeforeGuard) {
        const callText = source.getText(declarator.init);
        context.report({
          node: declarator,
          messageId: "requireIsValid",
          suggest: [
            {
              messageId: "suggestGuard",
              data: { id: identifierName, call: callText },
              fix(fixer): TSESLint.RuleFix[] {
                const fixes: TSESLint.RuleFix[] = [];
                const importFix = ensureDateFnsNamedImports(context, fixer, [
                  "isValid",
                ]);
                if (importFix) {
                  fixes.push(importFix);
                }
                const newText = `const ${identifierName} = ${callText};
if (!isValid(${identifierName})) {
  // TODO: handle invalid date
}
`;
                fixes.push(
                  fixer.replaceTextRange(parentDeclaration.range, newText),
                );
                return fixes;
              },
            },
          ],
        });
      }
    }

    return {
      VariableDeclarator: checkDeclarator,
    };
  },
});
