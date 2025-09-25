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
 * Gets first non-spread argument from call or constructor expression.
 */
export function getFirstArgument(
  node: TSESTree.CallExpression | TSESTree.NewExpression,
): TSESTree.Expression | undefined {
  const first = node.arguments[0];
  return first && first.type !== "SpreadElement" ? first : undefined;
}

/**
 * Safely gets the range from an AST node, throwing an error if not available.
 */
export function getNodeRange(node: TSESTree.Node): readonly [number, number] {
  if (!node.range) {
    throw new Error(
      `Node range is not available. This should not happen in a properly configured ESLint environment.`,
    );
  }
  return node.range;
}
