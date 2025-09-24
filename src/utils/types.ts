import * as ts from "typescript";
import type { TSESTree } from "@typescript-eslint/utils";

/**
 * Checks if TypeScript type is a union type.
 */
function isUnionType(typeToCheck: ts.Type): typeToCheck is ts.UnionType {
  return (typeToCheck.getFlags() & ts.TypeFlags.Union) !== 0;
}

/**
 * Checks if TypeScript type represents numeric values including unions.
 */
export function isTypeNumberish(typeToCheck: ts.Type): boolean {
  const flags = typeToCheck.getFlags();
  if (
    (flags & ts.TypeFlags.NumberLike) !== 0 ||
    (flags & ts.TypeFlags.NumberLiteral) !== 0
  ) {
    return true;
  }
  if (isUnionType(typeToCheck)) {
    return typeToCheck.types.some((type) => isTypeNumberish(type));
  }
  return false;
}

/**
 * Converts null to undefined for consistent API.
 */
export function nullToUndefined<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Gets AST node range as tuple.
 */
export function getNodeRange(node: TSESTree.Node): [number, number] {
  return node.range!;
}

/**
 * Gets first non-spread argument from call or constructor expression.
 */
export function getFirstArgument(
  node: TSESTree.CallExpression | TSESTree.NewExpression,
): TSESTree.Expression | undefined {
  const first = node.arguments[0];
  return first && first.type !== "SpreadElement" ? first : undefined;
}
