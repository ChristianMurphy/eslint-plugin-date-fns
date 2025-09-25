import {
  AST_NODE_TYPES,
  ASTUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import { getNodeRange } from "./types.js";

/**
 * Detects Date constructor patterns including globalThis.Date.
 */
export function isNewDateSyntax(node: TSESTree.NewExpression): boolean {
  const { callee } = node;
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee)) {
    return callee.name === "Date";
  }
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.MemberExpression)(callee)) {
    const object = callee.object;
    const property = callee.property;
    return (
      ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(object) &&
      object.name === "globalThis" &&
      ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(property) &&
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
  if (ASTUtils.isNodeOfType(AST_NODE_TYPES.MemberExpression)(callee)) {
    return false;
  }
  if (
    !ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee) ||
    callee.name !== "Date"
  ) {
    return false;
  }

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
  if (
    !ASTUtils.isNodeOfType(AST_NODE_TYPES.Identifier)(callee) ||
    callee.name !== "Date"
  ) {
    return false;
  }

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
