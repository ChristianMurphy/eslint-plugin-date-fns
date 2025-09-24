import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { getNodeRange } from "./types.js";

/**
 * Checks if node is an Identifier.
 */
function isIdentifier(
  nodeToCheck: TSESTree.Node,
): nodeToCheck is TSESTree.Identifier {
  return nodeToCheck.type === "Identifier";
}

/**
 * Checks if node is a MemberExpression.
 */
function isMemberExpression(
  nodeToCheck: TSESTree.Node,
): nodeToCheck is TSESTree.MemberExpression {
  return nodeToCheck.type === "MemberExpression";
}

/**
 * Detects Date constructor patterns including globalThis.Date.
 */
export function isNewDateSyntax(node: TSESTree.NewExpression): boolean {
  const { callee } = node;
  if (isIdentifier(callee)) return callee.name === "Date";
  if (isMemberExpression(callee)) {
    const object = callee.object;
    const property = callee.property;
    return (
      isIdentifier(object) &&
      object.name === "globalThis" &&
      isIdentifier(property) &&
      property.name === "Date"
    );
  }
  return false;
}

/**
 * Checks if Date identifier is shadowed by local declaration.
 */
export function isDateShadowed(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  node: TSESTree.NewExpression,
): boolean {
  const { callee } = node;
  // globalThis.Date cannot be shadowed
  if (isMemberExpression(callee)) return false;
  if (!isIdentifier(callee) || callee.name !== "Date") return false;

  const sourceCode = context.getSourceCode();
  const scopeManager = sourceCode.scopeManager;
  if (scopeManager === null) return false;

  // Search through all scopes to find any that declare Date
  for (const scope of scopeManager.scopes) {
    const dateVariable = scope.variables.find(
      (variable) => variable.name === "Date",
    );
    if (dateVariable && dateVariable.defs.length > 0 && scope.block.range) {
      const [scopeStart, scopeEnd] = scope.block.range;
      const [nodeStart, nodeEnd] = getNodeRange(node);

      if (nodeStart >= scopeStart && nodeEnd <= scopeEnd) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detects bare Date() calls that reference the global Date function.
 */
export function isBareGlobalDateCall(
  context: Readonly<TSESLint.RuleContext<string, unknown[]>>,
  node: TSESTree.CallExpression,
): boolean {
  const { callee } = node;

  // Must be a simple identifier call to "Date"
  if (!isIdentifier(callee) || callee.name !== "Date") return false;

  const sourceCode = context.getSourceCode();
  const scopeManager = sourceCode.scopeManager;
  if (scopeManager === null) return true;

  // Search through all scopes to find any that declare Date
  for (const scope of scopeManager.scopes) {
    const dateVariable = scope.variables.find(
      (variable) => variable.name === "Date",
    );
    if (dateVariable && dateVariable.defs.length > 0 && scope.block.range) {
      const [scopeStart, scopeEnd] = scope.block.range;
      const [nodeStart, nodeEnd] = getNodeRange(node);

      if (nodeStart >= scopeStart && nodeEnd <= scopeEnd) {
        return false;
      }
    }
  }

  return true;
}
