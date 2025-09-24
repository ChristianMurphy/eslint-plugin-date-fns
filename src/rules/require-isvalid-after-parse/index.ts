import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import type { TSESLint } from "@typescript-eslint/utils";
import { ensureDateFnsNamedImports } from "../../utils/imports.js";

const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/ChristianMurphy/eslint-plugin-date-fns/blob/main/docs/rules/${name}.md`,
);

type Options = [];
type MessageIds = "requireIsValid" | "suggestGuard";

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
    case "CallExpression": {
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
                fixes.push(
                  ensureDateFnsNamedImports(context, fixer, ["isValid"]),
                );
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
